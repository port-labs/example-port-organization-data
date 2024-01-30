# Ingesting Port Users and Teams


## Overview

In this example, you will create blueprints for `user` and `team` that ingests all users and teams from your [Port account](https://app.getport.io). You will then add some python script to make API calls to Port's REST API and fetch data for your account.

## Getting started

Log in to your Port account and create the following blueprints:

### User blueprint
Create the project blueprint in Port [using this json file](./resources/user.json)

### Team blueprint
Create the repository blueprint in Port [using this json file](./resources/team.json)


### Running the python script

To ingest data from your Port account to Port, run the following commands: 

```
export PORT_CLIENT_ID=<ENTER CLIENT ID>
export PORT_CLIENT_SECRET=<ENTER CLIENT SECRET>

git clone https://github.com/port-labs/example-port-organization-data.git

cd example-port-organization-data

pip install -r ./requirements.txt

python app.py
```

The list of variables required to run this script are:
- `PORT_CLIENT_ID`
- `PORT_CLIENT_SECRET`

Find your port client id and secret from [this guide](https://docs.getport.io/build-your-software-catalog/sync-data-to-catalog/api/#find-your-port-credentials)

Done! you will now be able to see your Port users and teams created as blueprint entities.
