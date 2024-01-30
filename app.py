import requests
from decouple import config
from loguru import logger
from typing import Any, List, Dict
from enum import StrEnum
import re


class ObjectKind(StrEnum):
    USER = "users"
    TEAM = "teams"


class PortAPI:
    def __init__(self, client_id: str, client_secret: str, api_url: str) -> None:
        self.client_id = client_id
        self.client_secret = client_secret
        self.api_url = api_url
        self.access_token = self.get_access_token()
        self.port_headers = {"Authorization": f"Bearer {self.access_token}"}

    def get_access_token(self) -> str:
        credentials = {"clientId": self.client_id, "clientSecret": self.client_secret}
        token_response = requests.post(
            f"{self.api_url}/auth/access_token", json=credentials
        )
        return token_response.json()["accessToken"]

    def add_entity_to_port(
        self, blueprint_id: str, entity_object: Dict[str, Any]
    ) -> None:
        response = requests.post(
            f"{self.api_url}/blueprints/{blueprint_id}/entities?upsert=true&merge=true",
            json=entity_object,
            headers=self.port_headers,
        )
        logger.info(response.json())

    def get_port_resource(
        self, objectkind: ObjectKind, query_param: Dict[str, Any] = None
    ) -> List[Dict[str, Any]]:
        logger.info(
            f"Requesting data for path: {objectkind} with params: {query_param}"
        )
        try:
            url = f"{self.api_url}/{objectkind}"
            response = requests.get(
                url=url, params=query_param, headers=self.port_headers
            )
            response.raise_for_status()
            response = response.json()

            if response["ok"]:
                result = response[objectkind]
                logger.info(f"Received size {len(result)} {objectkind}")
                return result
            else:
                logger.info(f"Error occurred while retrieving data for {objectkind}")
                return []

        except requests.exceptions.HTTPError as e:
            logger.error(
                f"HTTP error with code {e.response.status_code}, content: {e.response.text}"
            )
            return {}

    def transform_identifier(self, identifier: str) -> str:
        pattern = r"^[A-Za-z0-9@_.:\\\\/=-]+$"
        if re.match(pattern, identifier):
            return identifier
        else:
            fixed_identifier = re.sub(r"[^A-Za-z0-9@_.:\\\\/=-]", "-", identifier)
            return fixed_identifier

    def process_user_entities(self, user_data: List[Dict[str, Any]]) -> None:
        logger.info("Upserting user entities to Port")
        blueprint_id = "user"
        for user in user_data:
            entity = {
                "identifier": user["email"],
                "title": f"{user['firstName']} {user['lastName']}",
                "properties": {
                    "status": user["status"],
                    "createdAt": user["createdAt"],
                    "userInPort": user["email"],
                    "providers": user["providers"]
                },
                "relations": {
                    "team": [self.transform_identifier(team["name"]) for team in user.get("teams", [])]
                },
            }
            self.add_entity_to_port(blueprint_id=blueprint_id, entity_object=entity)

    def process_team_entities(self, team_data: List[Dict[str, Any]]) -> None:
        logger.info("Upserting team entities to Port")
        blueprint_id = "team"
        for team in team_data:
            team_identifier = self.transform_identifier(team["name"])
            entity = {
                "identifier": team_identifier,
                "title": team["name"],
                "properties": {
                    "description": team.get("description"),
                },
                "relations": {
                },
            }
            self.add_entity_to_port(blueprint_id=blueprint_id, entity_object=entity)


if __name__ == "__main__":
    port_api = PortAPI(
        client_id=config("PORT_CLIENT_ID"),
        client_secret=config("PORT_CLIENT_SECRET"),
        api_url="https://api.getport.io/v1",
    )

    user_query_params: Dict[str, Any] = {
        "fields": ["email", "firstName", "lastName", "status", "providers", "createdAt", "teams.name"]
    }

    user_data = port_api.get_port_resource(objectkind=ObjectKind.USER, query_param=user_query_params)
    team_data = port_api.get_port_resource(objectkind=ObjectKind.TEAM)

    port_api.process_user_entities(user_data=user_data)
    port_api.process_team_entities(team_data=team_data)
