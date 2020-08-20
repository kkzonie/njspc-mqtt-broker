# njspc-mqtt-broker - Version 0.9.1

## What is njspc-mqtt-broker?
njspc-mqtt-broker is an application or middleware that sits between the awesome nodejs-poolcontroller v6.X and an MQTT broker such as Mosquitto allowing any Home Automation platform that integrates with MQTT to communicate with a supported Pentair pool controller. Both sensors (read-only) and states (read-write) are supported.

### Prerequisites
* Have a supported Pentair Pool Controller supported by [nodejs-poolcontroller v6.X](https://github.com/tagyoureit/nodejs-poolController)
* A fucntional nodejs-poolcontroller v6.X installation which is porerly communicating to your supported Pool Contoller
* A functional MQTT broker up and running such as [Eclipse Mosquitto™](https://mosquitto.org/download/)
* And of course a Home Automation platform such as [Home Assistant](https://www.home-assistant.io)

## Supported Pool Equipment Elements and MQTT Topcis/Messages in v0.9.1
|Equipment Element|MQTT Topic|Sensor (read-only)|State (Read-Write)| Example Message|
|:-:|:-|:-:|:-:|:-:|
|Equipment|pool/equipment/controllertype/sensor|X| | IntelliCenter|
|Equipment|pool/equipment/model/sensor|X| |IntelliCenter i10PS|
|Equipment|pool/equipment/softwareversion/sensor|X| |1.04|
|Equipment| pool/equipment/batteryvoltage/sensor |X| |4.2|
|Temps|pool/temps/watersensor1/sensor|X| |84|
|Temps|pool/temps/watersensor1/air/sensor|X| |91|
|Temps|pool/temps/watersensor1/solar/sensor|X| |93|
|Circuits|pool/circuits/**_id_**/**_name_**/state| |X|on|
|Features|pool/features/**_id_**/**_name_**/state| |X|off|
|Pumps|pool/pumps/**_id_**/**_name_**/status/state| |X|on|
|Pumps|pool/pumps/**_id_**/**_name_**/watts/sensor|X| |144|
|Pumps|pool/pumps/**_id_**/**_name_**/rpm/sensor|X| |1293|
|Pumps|pool/pumps/**_id_**/**_name_**/flow/sensor|X| |23|
|Bodies|pool/bodies/**_id_**/**_name_**/heatertemp/sensor|X| |100|
|Bodies|pool/bodies/**_id_**/**_name_**/bodystate/sensor|X| |on|
|Bodies|pool/bodies/**_id_**/**_name_**/heatersetpoint/state| |X|103|
|Chlorinators|pool/chlorinators/**_id_**/**_name_**/status/sensor|X| |ok|
|Chlorinators|pool/chlorinators/**_id_**/**_name_**/targetoutput/sensor|X| |30|
|Chlorinators|pool/chlorinators/**_id_**/**_name_**/saltlevel/sensor|X| |3800|
|Chlorinators|pool/chlorinators/**_id_**/**_name_**/poolsetpoint/state| |X|30|
|Chlorinators|pool/chlorinators/**_id_**/**_name_**/spasetpoint/state| |X|0|
|Lightgroups|pool/lightgroups/**_id_**/**_name_**/state| |X|off|

## Installation Instructions

### Prerequisites
If you don't know anything about NodeJS, these directions might be helpful.

1. Install Nodejs (v12 recommended). (https://nodejs.org/en/download/)
2. Update NPM (https://docs.npmjs.com/getting-started/installing-node).
3. Download the latest [code release](https://github.com/kkzonie/njspc-mqtt-broker/releases)
   OR
   clone with `git clone git@github.com:kkzonie/njspc-mqtt-broker.git`
4. Unzip into njspc-mqtt.broker.
5. Run 'npm install' in the new folder (where package.json exists).  This will automatically install all the dependencies (mqtt, axios, sockets.io, etc).
6. Edit the /config/config.json to meet your requirements for connecting to your MQTT broker and your nodejs-poolcontroller installation.

config.json Screenshot

<img src="https://github.com/kkzonie/njspc-mqtt-broker/blob/master/config.json.png" height="300">

* `{`
* &nbsp;&nbsp;`"mqtt": {`
* &nbsp;&nbsp;`"ip": "127.0.0.1",` <-- change to your MQTT Broker IP
* &nbsp;&nbsp;`"port": "1883",` <-- change to your MQTT Broker Port
* &nbsp;&nbsp;`"userName": "user123",` <-- change to your MQTT Broker User Name
* &nbsp;&nbsp;`"password": "password123",` <-- change to your MQTT Broker User Password
* &nbsp;&nbsp;`"publishTopic": "pool",` <-- Desired MQTT base topic, "pool" typically is sufficiant
* &nbsp;&nbsp;`"publishRetain": "true",` <-- Set to true or false depending on your need
* `},`
* &nbsp;&nbsp;`"njspc": {`
* &nbsp;&nbsp;`"ip": "127.0.0.1",` <-- change to your nodejs-poolcontroller IP
* &nbsp;&nbsp;`"port": "4200",` <-- change to your nodejs-poolcontroller Port (normally 4200)
* `{`
7. Run the app with `npm start`.
   * `npm start` will compile the Typescript code.  You should use this every time you download/clone/pull the latest code.
   * `npm run start:cached` will run the app without compiling the code which can be much faster.

## Automate startup of app
- Todo

# Home Automation Usage
Ok, so now you have the following up and running.
- An MQTT Broker
- nodejs-poolcontroller v6.X
- njspc-mqtt-broker installed and running, and communicating to both your MQTT Broker and nodejs-poolcontroller installation
- An Home Automation Platform that supports MQTT such as Home Assistant

njspc-mqtt-broker upon application startup will gather pool equipment element sensor and state infomation. Pool equipment element Name and ID metadata as defined in your pool controller will be used to create the topcis. For example:

- Pool Controller circuit/relay 1 is configured for "Pool" which turns on/off the Pool Pump. This circuit may also have a valve actualtor turn a valve as part of this circuit being toggled.

njspc-mqtt-broker will log the output to the console. Note this information to determine your discovered MQTT topic info.

## Example njspc-mqtt-broker Log Output
2020-08-19 21:58:44 HTTP: OK (GET) All Current State info from njsPC  
=== Processing Element: circuits ====  
2020-08-19 21:58:44 MQTT: OK (Publish) Topic:***`pool/circuits/1/pool/state`*** Message:off  
2020-08-19 21:58:44 MQTT: OK (Publish) Topic:pool/circuits/5/spalight/state Message:on  
=== Processing Element: features ====  
2020-08-19 21:58:44 MQTT: OK (Publish) Topic:pool/features/129/waterscuppers/state Message:off  

## Home Assistant Configuration Example for a Circuit
- Configured as a switch
- Sensor topics end with /sensor and are read-only
- State topcis end with /state and are read-write
- States can only be changes by publishing an of or off message to /set. Example: pool/circuits/6/pool/state/**set**

**Configuration.yaml**  

`- switch:`  
&nbsp;&nbsp;&nbsp;&nbsp;`- platform: mqtt`  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`name: Pool`  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`icon: mdi:pool`  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`state_topic: "pool/circuits/1/pool/state"`  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`command_topic: 'pool/circuits/1/pool/state/set'`  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`payload_on: "on"`  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`payload_off: "off"`  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`optimistic: false`  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`retain: false`  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`qos: 0`  

`- template:`  
&nbsp;&nbsp;&nbsp;&nbsp;`- sensors:`  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`- platform: mqtt`  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`name: "Pool Water Temp"`  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`state_topic: "pool/temps/watersensor1/sensor"`  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`unit_of_measurement: '°F'`  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`value_template: "{{ value_json }}"`  

**Home Assistant Lovelace UI Screenshot**

<img src="https://github.com/kkzonie/njspc-mqtt-broker/blob/master/HA Lovelace.png" height="300">

# Support
- Todo

# Changed/dropped since v0.9.0
1. Added support for Lightgroups (state | on/off)

# Credit
- Todo

# License
njspc-mqtt.broker.  An MQTT broker for Nodejs-PoolController v6.X. By Kelly Kimball, kkzonie.  kkzonie11@gmail.com
This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.
You should have received a copy of the GNU Affero General Public License along with this program.  If not, see <http://www.gnu.org/licenses/>.
