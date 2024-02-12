import axios, { AxiosResponse } from 'axios';

enum ObjectKind {
    USER = 'users',
    TEAM = 'teams',
}

interface EntityObject {
    [key: string]: any;
}

class PortAPI {
    private client_id: string;
    private client_secret: string;
    private api_url: string;
    private access_token: string;

    constructor(client_id: string, client_secret: string, api_url: string) {
        this.client_id = client_id;
        this.client_secret = client_secret;
        this.api_url = api_url;
        this.access_token = '';
    }

    private async getAccessToken(): Promise<string> {
        const credentials = { clientId: this.client_id, clientSecret: this.client_secret };
        try {
            const response = await axios.post(`${this.api_url}/auth/access_token`, credentials);
            this.access_token = response.data.accessToken;
            return this.access_token;
        } catch (error) {
            console.error(`Error getting access token: ${error}`);
            return '';
        }
    }

    private async getPortHeaders(): Promise<Record<string, string>> {
        if (!this.access_token) {
            await this.getAccessToken();
        }
        return { Authorization: `Bearer ${this.access_token}` };
    }

    async addEntityToPort(blueprint_id: string, entityObject: EntityObject): Promise<void> {
        try {
            const port_headers = await this.getPortHeaders();
            const response = await axios.post(`${this.api_url}/blueprints/${blueprint_id}/entities?upsert=true&merge=true`, entityObject, {
                headers: port_headers,
            });
            console.log(response.data);
        } catch (error: any) {
            console.error(`Error adding ${blueprint_id} to Port: ${error?.response?.data?.message || error.message}`);
        }
    }

    async getPortResource(objectKind: ObjectKind, queryParam: Record<string, any> | null = null): Promise<EntityObject[]> {
        var url = `${this.api_url}/${objectKind}`;
        if (queryParam && queryParam.fields && Array.isArray(queryParam.fields)) {
            const fieldsQueryString = queryParam.fields.map(field => `fields=${encodeURIComponent(field)}`).join('&');
            url += `?${fieldsQueryString}`;
            delete queryParam.fields; // Remove the 'fields' property from queryParam
        }

        try {
            const port_headers = await this.getPortHeaders();
            const response = await axios.get(url, { params: queryParam, headers: port_headers });
            const data = response.data;
            console.log(data)
            if (data.ok) {
                console.log(`Received size ${data[objectKind].length} ${objectKind}`);
                return data[objectKind];
            } else {
                console.error(`Error occurred while retrieving data for ${objectKind}: ${data.message}`);
                return [];
            }
        } catch (error) {
            console.error(`Error getting Port resource: ${error}`);
            return [];
        }
    }

    transformIdentifier(identifier: string): string {
        const pattern = /^[A-Za-z0-9@_.:\\\\/=-]+$/;
        if (pattern.test(identifier)) {
            return identifier;
        } else {
            const fixedIdentifier = identifier.replace(/[^A-Za-z0-9@_.:\\\\/=-]/g, '-');
            return fixedIdentifier;
        }
    }

    async processUserEntities(userData: EntityObject[]): Promise<void> {
        console.log('Upserting user entities to Port');
        const blueprintId = 'user';
        for (const user of userData) {
            if (!user.email.StartsWith("devops-port")) {
                const entity: EntityObject = {
                    identifier: user.email,
                    title: `${user.firstName} ${user.lastName}`,
                    properties: {
                        status: user.status,
                        createdAt: user.createdAt,
                        userInPort: user.email,
                        providers: user.providers,
                    },
                    relations: {
                        team: (user.teams || []).map((team: any) => this.transformIdentifier(team.name)),
                    },
                };
                await this.addEntityToPort(blueprintId, entity);
            }
        }
    }

    async processTeamEntities(teamData: EntityObject[]): Promise<void> {
        console.log('Upserting team entities to Port');
        const blueprintId = 'team';
        for (const team of teamData) {
            const teamIdentifier = this.transformIdentifier(team.name);
            const entity: EntityObject = {
                identifier: teamIdentifier,
                title: team.name,
                properties: {
                    description: team.description || null,
                },
                relations: {},
            };
            await this.addEntityToPort(blueprintId, entity);
        }
    }
}

(async () => {
    const portApi = new PortAPI(
        process.env.PORT_CLIENT_ID || '',
        process.env.PORT_CLIENT_SECRET || '',
        'https://api.getport.io/v1',
    );

    const userQueryParams: Record<string, any> = {
        fields: ['email', 'firstName', 'lastName', 'status', 'providers', 'createdAt', 'teams.name'],
    };

    try {
        const userData = await portApi.getPortResource(ObjectKind.USER, userQueryParams);
        const teamData = await portApi.getPortResource(ObjectKind.TEAM);

        await portApi.processTeamEntities(teamData);
        await portApi.processUserEntities(userData);
    } catch (error) {
        console.error(`Error: ${error}`);
    }
})();
