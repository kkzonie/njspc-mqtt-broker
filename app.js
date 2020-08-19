/*  njspc-mqtt.broker.  An MQTT broker for Nodejs-PoolController v6.X.
By Kelly Kimball, kkzonie.  kkzonie11@gmail.com
This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.
You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
//glogal variables
var mqttConnected = false;

//config
if (process.env.NODE_ENV == undefined) { process.env.NODE_ENV = "config" }

const config = require('config');
console.log('Using Config ENV: ' + config.util.getEnv('NODE_ENV'));

//load config paremeters
const njspc_ip = config.get('njspc.ip');
const njspc_port = config.get('njspc.port');
const mqtt_ip = config.get('mqtt.ip');
const mqtt_port = config.get('mqtt.port');
const mqtt_userName = config.get('mqtt.userName');
const mqtt_password = config.get('mqtt.password');
const mqtt_publishTopic = config.get('mqtt.publishTopic');
const mqtt_publishRetain = config.get('mqtt.publishRetain');
const mqtt_publishQos = config.get('mqtt.publishQos');

//setup moment
var moment = require('moment'); // require

//setup jsonata
var jsonata = require("jsonata");

//setup socket.io-client
var io = require('socket.io-client'),
ioClient = io.connect("http://"+String(njspc_ip)+":"+String(njspc_port));

//setup mqtt connect values
var mqtt = require('mqtt')

//ip:port of MQTT server i.e. mosquitto
var mqtt_host = "http://"+String(mqtt_ip)+":"+String(mqtt_port)

//mqtt options
var mqtt_options = {
  //credentials for MQTT server (if applicable)
  username: mqtt_userName,
  password: mqtt_password
}
var mqttClient = mqtt.connect(mqtt_host, mqtt_options)

//when connected to MQTT, subscribe to "set" topcis using wildcards
mqttClient.on('connect', function () {
  console.log('MQTT: OK (Connected)')
  //subscribe to {mqtt_publishTopic}/+/+/+/state/set topic to listen for all inbound state SET messages only!
  //we do not want to send back out regular states looped back and then back out to njsPC!!
  mqttClient.subscribe(String(mqtt_publishTopic)+"/+/+/+/state/set", function (err) {
    if (!err) {
      mqttConnected = true;
      console.log('MQTT: OK (Subscribed to '+String(mqtt_publishTopic)+'/+/+/+/state/set topic)')
        mqttClient.subscribe(String(mqtt_publishTopic)+"/+/+/+/+/state/set", function (err) {
          if (!err) {
            console.log('MQTT: OK (Subscribed to '+String(mqtt_publishTopic)+'/+/+/+/+/state/set topic)')
            //---> if we successfully connect to MQTT, start initial pool element state processing
            getInitialPoolElementStates();
          }
        })
    }
  })

  //mqttConnected = true;
  //when MQTT message is received in which we are subscribed to then process
  mqttClient.on("message", onMqttMessageReceived)
});

//setup axios and make poolController api call for state/all
const axios = require('axios');

//using moment for logging etc.
function timeStamp () {
  var datetime = moment().format('YYYY-MM-DD HH:mm:ss');
  return datetime
}

//
//
//used for initial njsPC state/all API call and to start initial pool element processing
async function getInitialPoolElementStates() {
  console.log("in func.getInitialPoolElementStates...")
  let response = await axios.get("http://"+String(njspc_ip)+":"+String(njspc_port)+"/state/all");
  let poolData = response.data;
  console.log("+++ Processing Initial Pool Element States +++")
  console.log('%s HTTP: OK (GET) All Current State info from njsPC', timeStamp())
  //process initial pool element states
  await processPoolElements("equipment", poolData);
  await processPoolElements("circuits", poolData);
  await processPoolElements("features", poolData);
  await processPoolElements("pumps", poolData);
  await processPoolElements("temps", poolData);
  await processPoolElements("bodies", poolData);
  await processPoolElements("chlorinators", poolData);
  await processPoolElements("lightGroups", poolData);

  console.log("=== Completed Initial Pool Element States ===")
  console.log("+++ Begin realtime njsPC monitoring for MQTT updates +++")
}

//process initial pool element states
async function processPoolElements (elementType, poolData) {
  //console.log("=== func.processPoolElements ===")
  console.log("=== Processing Element: %s ====", elementType)

  //process basic equipment elements
  if (elementType === "equipment") {
    elementName = ["controllerType", "model", "softwareVersion", "batteryVoltage"];
    for (i=0; i<=elementName.length - 1;i++) {
      if (elementName[i] === "batteryVoltage") {
        var elementSensor = String(elementName[i])
       } else {
        var elementSensor = String(elementType)+"."+String(elementName[i])
       }
      var element_name = elementName[i];
      var element_value = String((jsonata(elementSensor).evaluate(poolData)));
      var element_id = "undefined";

      var mqttDataArray = [elementType, element_id, element_name, "sensor", element_value];
      await sendMqttElementState(...mqttDataArray)
    }
  }
  
  //process circuits and features elements together since they have the same attributes
  if (elementType === "circuits" || elementType === "features" || elementType === "lightGroups") {
    var circuitCount = (jsonata("$count($[0]."+String(elementType)+")").evaluate(poolData));
    for (i=0; i<=circuitCount - 1;i++) {
        //console.log("elementId: ",elementId);
        //console.log("elementName: ",elementName);
        //console.log("elementState: ",elementState);
      var element_id = (jsonata(String(elementType)+"["+String(i)+"].id").evaluate(poolData));
      var element_name = (jsonata(String(elementType)+"["+String(i)+"].name").evaluate(poolData));
      element_name = element_name.split(" ").join("");
      var element_state = (jsonata(String(elementType)+"["+String(i)+"].isOn").evaluate(poolData));
        //console.log("element id:",element_id);
        //console.log("element name:",element_name);
        //console.log("element state:",element_state);
      if (element_state) {
        element_state = "on"
      } else {
        element_state = "off"
      }
      var mqttDataArray = [elementType, element_id, element_name, "state", element_state];
      await sendMqttElementState(...mqttDataArray)
  	}
  }

  //process pump elements
  if (elementType === "pumps") {
    var pumpCount = (jsonata("$count($[0]."+String(elementType)+")").evaluate(poolData));
    for (i=0; i<=pumpCount - 1;i++) {
 
      var pump_id = (jsonata(String(elementType)+"["+String(i)+"].id").evaluate(poolData));
      var pump_name = (jsonata(String(elementType)+"["+String(i)+"].name").evaluate(poolData));
      pump_name = pump_name.split(" ").join("");
      pump_name = pump_name.replace('/', '');
      var pump_watts = (jsonata(String(elementType)+"["+String(i)+"].watts").evaluate(poolData)).toString();
      
      if (pump_watts > 0 ) {
        var pump_status = "on";
      } else {
        var pump_status = "off";
      }
      
      var pump_rpm = (jsonata(String(elementType)+"["+String(i)+"].rpm").evaluate(poolData)).toString();
      var pump_flow = (jsonata(String(elementType)+"["+String(i)+"].flow").evaluate(poolData)).toString();
        // console.log("pump id:", pump_id);
        // console.log("pump name:", pump_name);
        // console.log("pump state:", pump_state);
        // console.log("pump watts:", pump_watts);
        // console.log("pump rpm:", pump_rpm);
        // console.log("pump flow:", pump_flow);
      var mqttDataArray = [elementType, String(pump_id)+"/"+String(pump_name), "status", "sensor", pump_status];
      await sendMqttElementState(...mqttDataArray)
      var mqttDataArray = [elementType, String(pump_id)+"/"+String(pump_name), "watts", "sensor", pump_watts];
      await sendMqttElementState(...mqttDataArray)
      var mqttDataArray = [elementType, String(pump_id)+"/"+String(pump_name), "rpm", "sensor", pump_rpm];
      await sendMqttElementState(...mqttDataArray)
      var mqttDataArray = [elementType, String(pump_id)+"/"+String(pump_name), "flow", "sensor", pump_flow];
      await sendMqttElementState(...mqttDataArray)
  	}
  }

  //Process chlorinators elements
  if (elementType === "chlorinators") {
    var chlor_id = (jsonata(String(elementType)+".id").evaluate(poolData));
    var chlor_name = (jsonata(String(elementType)+".name").evaluate(poolData));
    
    if (chlor_name == "") {
      chlor_name = "chlorinator"
    }    
    
    var chlor_status = (jsonata(String(elementType)+".status.name").evaluate(poolData));
    var chlor_target_output = (jsonata(String(elementType)+".targetOutput").evaluate(poolData)).toString();
    var chlor_salt_level = (jsonata(String(elementType)+".saltLevel").evaluate(poolData)).toString();
    var chlor_pool_setpoint = (jsonata(String(elementType)+".poolSetpoint").evaluate(poolData)).toString();
    var chlor_spa_setpoint = (jsonata(String(elementType)+".spaSetpoint").evaluate(poolData)).toString();
    
    //publish chlorinator sensors (one-way read-only)
    var chlor_values = [chlor_status, chlor_target_output, chlor_salt_level];
    var elementName = ["status", "targetoutput", "saltlevel"];
    
    for (j=0; j<=elementName.length - 1;j++) {
      var mqttDataArray = [elementType, String(chlor_id)+"/"+String(chlor_name), elementName[j], "sensor", chlor_values[j]];
      await sendMqttElementState(...mqttDataArray)
    }
    
    //publish chlorinator setpoints are states (two-way modifiable)
    var mqttDataArray = [elementType, String(chlor_id)+"/"+String(chlor_name), "poolsetpoint", "state", chlor_pool_setpoint];
    await sendMqttElementState(...mqttDataArray)
    
    var mqttDataArray = [elementType, String(chlor_id)+"/"+String(chlor_name), "spasetpoint", "state", chlor_spa_setpoint];
    await sendMqttElementState(...mqttDataArray)  
  }
  
  //process basic sensor temps "waterSensor1", "air", "solar"
  if (elementType === "temps") {
    elementName = ["waterSensor1", "air", "solar"];
    for (i=0; i<=elementName.length - 1;i++) {
      var elementSensor = String(elementType)+"."+String(elementName[i])
      var element_id = "undefined";
      var element_name = elementName[i];
      var element_value = String((jsonata(elementSensor).evaluate(poolData)));

      var mqttDataArray = [elementType, element_id, element_name, "sensor", element_value];
      await sendMqttElementState(...mqttDataArray)
    }
  }

  //process water bodies and heater elements
  if (elementType === "bodies") {
    var bodiesCount = (jsonata("$count($[0].temps."+String(elementType)+")").evaluate(poolData));
    for (i=0; i<=bodiesCount - 1;i++) {
      var bodies_id = String(jsonata("temps."+String(elementType)+"["+String(i)+"].id").evaluate(poolData));
      var bodies_name = String(jsonata("temps."+String(elementType)+"["+String(i)+"].name").evaluate(poolData));
      var bodies_heater_mode = String(jsonata("temps."+String(elementType)+"["+String(i)+"].heatMode.name").evaluate(poolData));
      var bodies_heater_status = String(jsonata("temps."+String(elementType)+"["+String(i)+"].heatStatus.name").evaluate(poolData));
      var bodies_heater_temp = String(jsonata("temps."+String(elementType)+"["+String(i)+"].temp").evaluate(poolData));
      if (bodies_heater_temp == "undefined") { bodies_heater_temp = "0"}
      var bodies_heater_setpoint = String(jsonata("temps."+String(elementType)+"["+String(i)+"].setPoint").evaluate(poolData));
      var bodies_body_state = String(jsonata("temps."+String(elementType)+"["+String(i)+"].isOn").evaluate(poolData));
      
      if (bodies_body_state) {
        bodies_body_state = "on"
      } else {
        bodies_body_state = "off"
      }

      var bodies_value = [bodies_heater_mode, bodies_heater_status, bodies_heater_temp, bodies_body_state];
      var elementName = ["heatermode", "heaterstatus", "heatertemp", "bodystate"];
      for (j=0; j<=elementName.length - 1;j++) {
        var mqttDataArray = [elementType, String(bodies_id)+"/"+String(bodies_name), elementName[j], "sensor", bodies_value[j]];
        await sendMqttElementState(...mqttDataArray)
      }
      //water body heater setpoints are states (two-way modifiable)
      var mqttDataArray = [elementType, String(bodies_id)+"/"+String(bodies_name), "heatersetpoint", "state", bodies_heater_setpoint];
      await sendMqttElementState(...mqttDataArray)      
  	}
  }

}

//Function to publish pool element sensor/state updates via mqtt
async function sendMqttElementState(elementType, elementId, elementName, elementStateType, elementValue) {
  //console.log("=== func.sendMqttElementState ===")
  elementName = elementName.split('/').join('');

  if (elementType == "lightGroups") {elementType = "lightgroups"}
    //console.log("elementType",elementType);
    //console.log("elementId",elementId);
    //console.log("elementName",elementName);
    //console.log("elementState",elementState);

  if (elementId !== 'undefined') {
    var circuit_str = String(mqtt_publishTopic)+"/"+String(elementType)+"/"+String(elementId)+"/"+String(elementName)+"/"+String(elementStateType)
  } else {
    var circuit_str = String(mqtt_publishTopic)+"/"+String(elementType)+"/"+String(elementName)+"/"+String(elementStateType)
  }
    
  circuit_str = circuit_str.toLowerCase();
  var state_str = (elementValue)
  if (mqttConnected) {
    console.log('%s MQTT: OK (Publish) Topic:%s Message:%s', timeStamp(), circuit_str, state_str)
    
    //setup MQTT publish options i.e. retain:true to MQTT server will retain current states after exit
    var publishOptions={
      retain:mqtt_publishRetain,
      qos:mqtt_publishQos};
    mqttClient.publish(circuit_str,state_str,publishOptions)
  } else {
    console.log('%s MQTT: ERROR (Not Connected)', timeStamp());
  }
}

//process real-time socket.io pool circuit state updates
ioClient.on("circuit", function(data) {
  console.log("=== Received socket.io(circuit) message ===")
    //console.log("circuitId: ",circuitId);
    //console.log("circuitName: ",circuitName);
    //console.log("circuitState: ",circuitState);
  var circuit_id = (jsonata("id").evaluate(data));
  var circuit_name = (jsonata("name").evaluate(data));
  circuit_name = circuit_name.split(" ").join("");
  var circuit_state = (jsonata("isOn").evaluate(data));
    //console.log("circuit_id:",circuit_id);
    //console.log("circuit_name:",circuit_name);
    //console.log("circuit_state:",circuit_state);
  
  if (circuit_state) {
    circuit_state = "on"
  } else {
    circuit_state = "off"
  }
  var mqttDataArray = ["circuits", circuit_id, circuit_name, "state", circuit_state];
  sendMqttElementState(...mqttDataArray)
})

//process real-time socket.io pool feature state updates
 ioClient.on("feature", function(data) {
  JSON.stringify(data)
  console.log("=== Received socket.io(feature) message ===")
    //console.log("feature",data)
    //console.log("featureId: ",featureId);
    //console.log("featureName: ",featureName);
    //console.log("featureState: ",featureState);
  var feature_id = (jsonata("id").evaluate(data));
  var feature_name = (jsonata("name").evaluate(data));
  feature_name = feature_name.split(" ").join("");
  var feature_state = (jsonata("isOn").evaluate(data));
    //console.log("feature_id:",feature_id);
    //console.log("feature_name:",feature_name);
    //console.log("feature_state:",feature_state);
  
  if (feature_state) {
    feature_state = "on"
  } else {
    feature_state = "off"
  }
  var mqttDataArray = ["features", feature_id, feature_name, "state", feature_state];
  sendMqttElementState(...mqttDataArray)
})

//process real-time socket.io pool pump state updates
ioClient.on("pump", function(data) {
  console.log("=== Received socket.io(pump) message ===")
    //console.log("pump",data)
    // console.log("pumpId: ",pumpId);
    // console.log("pumpName: ",pumpName);
    // console.log("pumpWatts: ",pumpWatts);
    // console.log("pumpRpm: ",pumpRpm);
    // console.log("pumpFlow: ",pumpFlow);
  var pump_id = (jsonata("id").evaluate(data));
  var pump_name = (jsonata("name").evaluate(data));
  pump_name = pump_name.split(" ").join("");
  pump_name = pump_name.replace('/', '');
  var pump_watts = (jsonata("watts").evaluate(data)).toString();
  
  if (pump_watts > 0 ) {
    var pump_status = "on";
  } else {
    var pump_status = "off";
  }
  
  var pump_rpm = (jsonata("rpm").evaluate(data)).toString();
  var pump_flow = (jsonata("flow").evaluate(data)).toString();
    // console.log("pump id:",pump_id);
    // console.log("pump name:",pump_name);
    // console.log("pump status:",pump_status);
    // console.log("pump watts:",pump_watts);
    // console.log("pump rpm:",pump_rpm);
    // console.log("pump flow:",pump_flow);
  var pumpSensorValues = [pump_status, pump_watts, pump_rpm, pump_flow];
  var pumpSensors = ["status", "watts", "rpm", "flow"];
  
  for (i=0; i<=pumpSensors.length - 1;i++) {
    var mqttDataArray = ["pumps", String(pump_id)+"/"+String(pump_name), pumpSensors[i], "sensor", pumpSensorValues[i]];
    sendMqttElementState(...mqttDataArray)
  }
})

//process real-time socket.io pool lightGroup state updates
ioClient.on("lightGroup", function(data) {
  console.log("=== Received socket.io(lightGroup) message ===")

  var lightgroup_id = (jsonata("id").evaluate(data));
  var lightgroup_name = (jsonata("name").evaluate(data));
  lightgroup_name = lightgroup_name.split(" ").join("");
  var lightgroup_state = (jsonata("isOn").evaluate(data));
    // console.log("lightgroup_id:",lightgroup_id);
    // console.log("lightgroup_name:",lightgroup_name);
    // console.log("lightgroup_state:",lightgroup_state);
  if (lightgroup_state) {
    lightgroup_state = "on"
  } else {
    lightgroup_state = "off"
  }
  var mqttDataArray = ["lightgroups", lightgroup_id, lightgroup_name, "state", lightgroup_state];
  sendMqttElementState(...mqttDataArray)
})

//process real-time socket.io pool temp sensor updates
ioClient.on("temps", function(data) {
  console.log("=== Received socket.io(temps) message ===")
  //console.log("temps",data)

  var tempName = ["waterSensor1", "air", "solar"];
  for (i=0; i<=tempName.length - 1;i++) {
    var temp_name = tempName[i];
    var temp_state = (jsonata(tempName[i]).evaluate(data)).toString();
    var mqttDataArray = ["temps", "undefined", temp_name, "sensor", temp_state];
    sendMqttElementState(...mqttDataArray)
  }
})

//process real-time socket.io pool body and heater sensor and state updates
ioClient.on("body", function(data) {
  console.log("=== Received socket.io(body) message ===")
  //console.log("body",data)

  var body_id = (jsonata("id").evaluate(data)).toString();
  var body_name = (jsonata("name").evaluate(data)).toString();
  var body_status = (jsonata("isOn").evaluate(data)).toString();
  var body_heater_mode = (jsonata("heatMode.name").evaluate(data)).toString();
  var body_heater_status = (jsonata("heatStatus.name").evaluate(data)).toString();
  var body_heater_temp = (jsonata("temp").evaluate(data)).toString();
  var body_heater_setpoint = (jsonata("setPoint").evaluate(data)).toString();
  
  //publish water body heater sensors (one-way read-only)
  var bodySensorValues = [body_status, body_heater_mode, body_heater_status, body_heater_temp];
  var bodySensors = ["bodystate", "heatermode", "heaterstatus", "heatertemp"];
  
  for (i=0; i<=bodySensors.length - 1;i++) {
    var mqttDataArray = ["bodies", String(body_id)+"/"+String(body_name), bodySensors[i], "sensor", bodySensorValues[i]];
    sendMqttElementState(...mqttDataArray)
  }
  //publish water body heater setpoint states (two-way modifiable)
  var bodyStateValues = [body_heater_setpoint];
  var bodyStates = ["heatersetpoint"];
  
  for (i=0; i<=bodyStates.length - 1;i++) {
    var mqttDataArray = ["bodies", String(body_id)+"/"+String(body_name), bodyStates[i], "state", bodyStateValues[i]];
    sendMqttElementState(...mqttDataArray)
  }
})

//process real-time socket.io pool temp state updates
ioClient.on("chlorinator", function(data) {
  console.log("=== Received socket.io(chlorinator) message ===")
  //console.log("chlorinator",data)

  var chlor_id = (jsonata("id").evaluate(data));
  var chlor_name = (jsonata("name").evaluate(data));
  var chlor_status = (jsonata("status.name").evaluate(data));
  var chlor_target_output = (jsonata("targetOutput").evaluate(data)).toString();
  var chlor_salt_level = (jsonata("saltLevel").evaluate(data)).toString();
  var chlor_pool_setpoint = (jsonata("poolSetpoint").evaluate(data)).toString();
  var chlor_spa_setpoint = (jsonata("spaSetpoint").evaluate(data)).toString();

  //publish chlorinator sensors (one-way read-only)
  var chlorSensorValues = [chlor_status, chlor_target_output, chlor_salt_level];
  var chlorSensors = ["status", "targetoutput", "saltlevel"];
  for (i=0; i<=chlorSensors.length - 1;i++) {
    var mqttDataArray = ["chlorinators", String(chlor_id)+"/"+String(chlor_name), chlorSensors[i], "sensor", chlorSensorValues[i]];
    sendMqttElementState(...mqttDataArray)
  }
  //publish chlorinator setpoints are states (two-way modifiable)
  var chlorStateValues = [chlor_pool_setpoint, chlor_spa_setpoint];
  var chlorStates = ["poolsetpoint", "spasetpoint"];
  for (i=0; i<=chlorStates.length - 1;i++) {
    var mqttDataArray = ["chlorinators", String(chlor_id)+"/"+String(chlor_name), chlorStates[i], "state", chlorStateValues[i]];
    sendMqttElementState(...mqttDataArray)
  }
})

//process real-time mqtt pool circuit updates
function onMqttMessageReceived(topic, message) {
  //console.log("=== func.onMqttMessageReceived ===")
  console.log('%s MQTT OK (Received Message) Topic:%s Message:%s',timeStamp(), topic, message);
  
  var topicSubString = topic.split('/')
  topicSubStringCount = topicSubString.length;
  topicSubString = topicSubString[(topicSubStringCount - 1)];
  
  //send state changes to njsPC for SET state only!!!
  if (topicSubString == "set") {
    //var topic_str = topic;
    var element_type = topic.split('/');
    element_type = element_type[1];

    var element_id = topic.split('/');
    element_id = element_id[2];

    var message_str = message.toString();

      //console.log("message_str: ", message_str)
      //console.log("element_type is: ", element_type);
      //console.log("element_id is: ", element_id);
      //console.log("topic is ", topic_str);
      //console.log("message is ", message_str);
    
    if (element_type == "circuits" || element_type == "features" || element_type == "lightgroups") {
      //njsPC seems to have a bug for setState to feature, using circuit for feature
      if (message_str == "on") {
        message_str = true
      } else {
        message_str = false
      }
      element_type = "circuit"
      var url = "http://10.20.1.250:4200/state/"+String(element_type)+"/setState"

      axios.put(url, {
        id: element_id,
        state: message_str
      })
      .then(function (response) {
        console.log('%s HTTP: OK (PUT) State Update for Element:%s Id:%s State:%s ',timeStamp(), element_type, element_id, message_str)
        //console.log(response);
      })
      .catch(function (error) {
        //console.log(error);
      });
    }

    if (element_type == "bodies") {
      element_type = "body"
      message_str = Number(message_str)
      element_id = Number(element_id)
      
      if (message_str <= 39) {
        message_str = 40
      }

      var url = "http://10.20.1.250:4200/state/"+String(element_type)+"/setPoint"
    
      axios.put(url, {
        id: element_id,
        setPoint: message_str
      })
      .then(function (response) {
        console.log(' %s HTTP: OK (PUT) State Update for Element:%s Id:%s State:%s ',timeStamp(), element_type, element_id, message_str)
        //console.log(response);
      })
      .catch(function (error) {
        console.log(error);
      });
    }

    if (element_type == "chlorinators") {
      element_type = "chlorinator"
      message_str = Number(message_str)
      element_id = Number(element_id)

      var chlorinator_body = topic.split('/');
      chlorinator_body = chlorinator_body[4];
      
      if (message_str >= 41) {
        message_str = 40
      }

      var url = "http://10.20.1.250:4200/state/"+String(element_type)+"/"+String(chlorinator_body)
    
      axios.put(url, {
        id: element_id,
        setPoint: message_str
      })
      .then(function (response) {
        console.log('%s HTTP: OK (PUT) State Update for Element:%s Id:%s State:%s ',timeStamp(), chlorinator_body, element_id, message_str)
        //console.log(response);
      })
      .catch(function (error) {
        console.log(error);
      });
    }


  }
}

process.on('SIGINT', function() {
  mqttClient.end(function (err) {
    if (!err) {
      console.log("MQTT disconnected")

      process.exit();
    }
  });
});
