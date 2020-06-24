import './style.scss'; // import styles as described https://github.com/webpack-contrib/sass-loader
import {Effector} from './effects';
import Draco from 'draco-vis';
import embed from 'vega-embed';
import * as Draco_core from 'draco-core'
import { json } from 'd3';


document.title = 'Worst-Yours-Best';

let draco_instance: Draco;
let effector: Effector;

let dataOptions: string | any[];

let data: any[];
let currentFields: string | any[];
let dataSummary: any;
let dataSetIndex = 0;

let currentEncodings = {};
let currentResult: any;
let curVegaSpec: any;
let specInit: any;

let availableEffects: any;

const init_draco = async () => {
  draco_instance = await (new Draco().init());
  let dataSelector = (document.getElementById('selectData') as HTMLSelectElement);
  dataOptions = ["---","cars.json", "parties.json", "pokemon.json"];
  
  for (let i = 0; i < dataOptions.length; i++){
    let option = document.createElement("option");
    option.text = dataOptions[i];
    dataSelector.add(option);
  }

  dataSelector.addEventListener("change",
            function()
            {
              const newIndex = dataSelector.selectedIndex;
              clearFieldCheckBoxes();
              if (newIndex != 0){
                fetch(dataOptions[dataSelector.selectedIndex])
                  .then(response => response.json())
                  .then(json => data = json).then( a => {
                    dataSetIndex = newIndex;
                    draco_instance.prepareData(data);
                    dataSummary = draco_instance.getSchema();
                    setFieldCheckBoxes();
                  }
                  );
                }
            });

  dataSelector.disabled = false;
  (document.getElementById('generateFromData') as HTMLButtonElement).disabled = false;
}

/*
Clears 'fields' (to be used when a new dataset is selected or
when the old one deselected);
*/
// ADD SAFETY, DISABLE BUTTONS!
const clearFieldCheckBoxes = () => {
  let flds = document.getElementById('fields');
  while (flds.firstChild) {
    flds.removeChild(flds.firstChild);
  }
  currentFields = [];
  dataSummary = [];
}

/*
Given a schema (Data summary, made by draco.prepareData, draco.getSchema)
populates the 'fields' form with checkboxes, corresponding to the fields
of the dataset;
*/
const setFieldCheckBoxes = () => {
  let flds = document.getElementById('fields');
  currentFields = Object.keys(dataSummary.stats)

  //console.log(dataSummary);

  for(let i = 0; i < currentFields.length; i++){
    // Creating checkbox with a unique ID;
    let box = document.createElement("INPUT");
    let box_id = "field_"+currentFields[i];
    box.setAttribute("type","checkbox");
    box.setAttribute("value", "0");
    box.setAttribute("id", box_id);
    // Creating label for the box for usability;
    let label = document.createElement("LABEL");
    label.setAttribute("for", box_id);
    label.innerHTML = " "+currentFields[i];
    // Line break for structure;
    let br = document.createElement("br");

    flds.appendChild(box);
    flds.appendChild(label);
    flds.appendChild(br);
  }
}

/*
Creating Draco specification based on boxes checked
*/
const generateDRACOSpecification = () => {
  currentEncodings = {};
  if (dataSetIndex == 0) {
    console.error("attempt to generate specification for dataset with index 0 (index reserved)");
    return;
  }

  let selectedFields = [];

  let dracoSpec ="% == Data definitions ==\n";
  dracoSpec += "data(\"" + dataOptions[dataSetIndex] + "\").\n";
  dracoSpec += "num_rows(" + (dataSummary.size as string) + ").\n\n";
  let e_index = 0;
  for(let i = 0; i < currentFields.length; i++){
    let box = (document.getElementById("field_"+currentFields[i]) as HTMLInputElement);
    if (box.checked) {
      const fieldName = currentFields[i];
      const fieldCardinality = dataSummary.stats[fieldName].distinct as string;
      const fieldType = dataSummary.stats[fieldName].type as string;
      selectedFields.push(fieldName);

      dracoSpec += "fieldtype(\""+fieldName+"\","+fieldType+").\n";
      dracoSpec += "cardinality(\""+fieldName+"\","+fieldCardinality+").\n\n";
      
      currentEncodings["e"+(e_index as unknown as string)] = {"type":fieldType, "name":fieldName};
      e_index++;
    }
  }
  dracoSpec += "% == Query constraints==\n";

  let encodings = Object.keys(currentEncodings);
  for(let i = 0; i < encodings.length; i++) {
    dracoSpec += "encoding(" + encodings[i] + ").\n"
    dracoSpec += ":- not field(" + encodings[i] + ",\"" 
                                 + currentEncodings[encodings[i]].name + "\").\n\n"
  }
  return dracoSpec;
}
// function for setting init viz-s
const init_plots = (fromData = true) => {

  if (fromData) {
    let draco_spec = generateDRACOSpecification();
    let number_of_models = 1;
    currentResult = draco_instance.solve(draco_spec,{"models":number_of_models});
    // console.log("Specification solved: ",currentResult, draco_spec);
    curVegaSpec = currentResult.specs[0];
  } else {
    curVegaSpec = JSON.parse((document.getElementById("vega_spec")as HTMLInputElement).value);
  }

  specInit = curVegaSpec;
  (document.getElementById("vega_spec") as HTMLInputElement).value = JSON.stringify(curVegaSpec).replace(/,\"/g,",\n\"");
  effector = new Effector(specInit, draco_instance);
  availableEffects = effector.getEffects();

  document.getElementById("ZeroBox").hidden = true;
  if (availableEffects.hasOwnProperty("Zero")) {
    document.getElementById("ZeroBox").hidden = false;
    (document.getElementById("Zero") as HTMLInputElement).checked = availableEffects["Zero"];
  }
  updatePlot("#vegaInit", specInit);
  updatePlot("#vegaWork", curVegaSpec);
}

/* VEGA */
const updatePlot = (vegaId : string, spec = curVegaSpec) => {
  embed(vegaId,spec);
}
// Sidebar
function openNav() {
  document.getElementById("data").style.width = "28%";
}

/* Set the width of the sidebar to 0 and the left margin of the page content to 0 */
function closeNav() {
  document.getElementById("data").style.width = "0";
}
document.getElementById('openDataBtn').addEventListener("click", openNav);
document.getElementById('closeDataBtn').addEventListener("click", closeNav);

//

document.getElementById('generateFromData').addEventListener("click", ()=>{init_plots(true)});
document.getElementById('generateFromSpec').addEventListener("click", ()=>{init_plots(false)});

document.getElementById('Zero').addEventListener("click", ZeroClick);
/*
document.getElementById('RedGrid').addEventListener("click", gridClick);
document.getElementById('BrightBackground').addEventListener("click", bgClick);
document.getElementById('Stars').addEventListener("click", starClick);
document.getElementById('Rainbow').addEventListener("click", rainbowClick);
*/
function ZeroClick(){
  if ((document.getElementById("Zero")as HTMLInputElement).checked) effector.activateEffect("Zero");
  else effector.deactivateEffect("Zero");
  curVegaSpec = effector.getCurrentSpec();
  updatePlot("#vegaWork", curVegaSpec);
}
/*
function gridClick(){
  if ((document.getElementById("RedGrid")as HTMLInputElement).checked) effector.activateEffect("RedGrid");
  else effector.deactivateEffect("RedGrid");
  const spec = JSON.stringify(effector.getCurrentSpec()).replace(/,\"/g,",\n\"");
  updatePlot("vegaWork", spec);
}
function bgClick(){
  if ((document.getElementById("BrightBackground")as HTMLInputElement).checked) effector.activateEffect("BrightBackground");
  else effector.deactivateEffect("BrightBackground");
  (document.getElementById("vega_spec")as HTMLInputElement).value = JSON.stringify(effector.getCurrentSpec()).replace(/,\"/g,",\n\"");
  updatePlot("vegaWork");
}
function starClick(){
  if ((document.getElementById("Stars")as HTMLInputElement).checked) effector.activateEffect("Stars");
  else effector.deactivateEffect("Stars");
  (document.getElementById("vega_spec")as HTMLInputElement).value = JSON.stringify(effector.getCurrentSpec()).replace(/,\"/g,",\n\"");
  updatePlot("vegaWork");
}
function rainbowClick(){
  if ((document.getElementById("Rainbow")as HTMLInputElement).checked) effector.activateEffect("Rainbow");
  else effector.deactivateEffect("Rainbow");
  (document.getElementById("vega_spec")as HTMLInputElement).value = JSON.stringify(effector.getCurrentSpec()).replace(/,\"/g,",\n\"");
  updatePlot("vegaWork");
}
*/
init_draco();