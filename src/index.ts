import './style.scss'; // import styles as described https://github.com/webpack-contrib/sass-loader
import Draco from 'draco-vis';
import embed from 'vega-embed';

document.title = 'Graph Destroyer';
document.getElementById('heading').textContent = 'Graph Destroyer';
let draco_instance: Draco;
let dataOptions: string | any[];

let data: any[];
let currentFields: string | any[];
let dataSummary: any;
let dataSetIndex = 0;

let currentEncodings = {};
let currentResult: any;
let curVegaSpec: {};
let specInit: {};

const arrSum = arr => arr.reduce((a,b) => a + b, 0);

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
              console.log(dataSelector.selectedIndex, dataOptions[dataSelector.selectedIndex]);
              
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
                    console.log(data);
                  }
                  );
                }
            });

  dataSelector.disabled = false;
  (document.getElementById('draco_reason') as HTMLButtonElement).disabled = false;
}

/*
Clears 'fields' if dataset (to be used when a new dataset is selected or
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

  console.log(dataSummary);

  // Title of the form;
  flds.innerHTML = "Available fields:<br>";

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
  console.log(dracoSpec);
  return dracoSpec;
}

const reason_plot = () => {
  let spec = generateDRACOSpecification();
  let number_of_models = 1;
  currentResult = draco_instance.solve(spec,{"models":number_of_models});
  console.log("Specification solved: ",currentResult);
  curVegaSpec = currentResult.specs[0];
  //console.log(curVegaSpec);
  (document.getElementById("vega_spec")as HTMLInputElement).value = JSON.stringify(curVegaSpec).replace(/,\"/g,",\n\"");
  specInit = curVegaSpec;
  updatePlot("vegaInit");
  updatePlot("vegaWork");
}
/* VEGA */
const updatePlot = (vegaId : string) => {
  if (vegaId == "vegaInit") {
    embed('#vegaInit',specInit,{theme: 'dark'});
  }
  else {
    let spec = JSON.parse((document.getElementById("vega_spec")as HTMLInputElement).value);
    curVegaSpec = spec;
    embed('#'+vegaId,spec,{theme: 'dark'});
  }
}

const addGrid = () => {
  let refresh = false;
  if (curVegaSpec["encoding"].hasOwnProperty("x")) {
    if (!curVegaSpec["encoding"]["x"].hasOwnProperty("axis")) {
      curVegaSpec["encoding"]["x"]["axis"] = {};
    }
    curVegaSpec["encoding"]["x"]["axis"]["grid"] = true;
    curVegaSpec["encoding"]["x"]["axis"]["gridColor"] = "red";
    refresh = true;
  }
  if (curVegaSpec["encoding"].hasOwnProperty("y")) {
    if (!curVegaSpec["encoding"]["y"].hasOwnProperty("axis")) {
      curVegaSpec["encoding"]["y"]["axis"] = {};
    }
    curVegaSpec["encoding"]["y"]["axis"]["grid"] = true;
    curVegaSpec["encoding"]["y"]["axis"]["gridColor"] = "red";
    refresh = true;
  }
  if (refresh) {
    (document.getElementById("vega_spec")as HTMLInputElement).value = JSON.stringify(curVegaSpec).replace(/,\"/g,",\n\"");
    updatePlot("vegaWork");
  }
}

const brightBackground = () => {
  if (!curVegaSpec.hasOwnProperty("config")) {
    curVegaSpec["config"] = {};
  }
  curVegaSpec["config"]["background"] = "cyan";
  (document.getElementById("vega_spec")as HTMLInputElement).value = JSON.stringify(curVegaSpec).replace(/,\"/g,",\n\"");
  updatePlot("vegaWork");
}

const neutralBackground = () => {
  if (!curVegaSpec.hasOwnProperty("config")) {
    curVegaSpec["config"] = {};
  }
  curVegaSpec["config"]["background"] = "lightgrey";
  (document.getElementById("vega_spec")as HTMLInputElement).value = JSON.stringify(curVegaSpec).replace(/,\"/g,",\n\"");
  updatePlot("vegaWork");
}

const addStars = () => {
  if (!(curVegaSpec["mark"] == "text")) {
    if ((curVegaSpec["encoding"]["x"]["type"] == "nominal")
    ||(curVegaSpec["encoding"]["x"]["type"] == "ordinal")
    ||(curVegaSpec["encoding"]["y"]["type"] == "nominal")
    ||(curVegaSpec["encoding"]["y"]["type"] == "ordinal")) {
      curVegaSpec["mark"] = "text";
      curVegaSpec["encoding"]["text"] = {};
      console.log(curVegaSpec);
      curVegaSpec["encoding"]["text"]["value"] = "⭐";
    }
    (document.getElementById("vega_spec")as HTMLInputElement).value = JSON.stringify(curVegaSpec).replace(/,\"/g,",\n\"");
    updatePlot("vegaWork");
  }
}

const cutAxis = () => {
  let refresh = false;
  if (curVegaSpec["encoding"].hasOwnProperty("y")) {
    if ((curVegaSpec["encoding"]["y"].hasOwnProperty("field"))
          &&(curVegaSpec["encoding"]["y"]["type"] == "quantitative")) {
      const fld = curVegaSpec["encoding"]["y"]["field"];
      const summary = draco_instance.getSchema();
      console.log(summary);
      const minVal = summary["stats"][fld]["min"];
      const maxVal = summary["stats"][fld]["max"];
      console.log(minVal,maxVal);
      const marg = maxVal * 0.1;
      curVegaSpec["encoding"]["y"]["scale"] = {};
      curVegaSpec["encoding"]["y"]["scale"]["domain"] = [minVal - marg, maxVal + marg];
      refresh = true;
    }
  }
  if (curVegaSpec["encoding"].hasOwnProperty("x")) {
    if ((curVegaSpec["encoding"]["x"].hasOwnProperty("field"))
        &&(curVegaSpec["encoding"]["x"]["type"]== "quantitative")) {
      const fld = curVegaSpec["encoding"]["x"]["field"];
      const summary = draco_instance.getSchema();
      console.log(summary);
      const minVal = summary["stats"][fld]["min"];
      const maxVal = summary["stats"][fld]["max"];
      console.log(minVal,maxVal);
      const marg = maxVal * 0.1;
      curVegaSpec["encoding"]["x"]["scale"] = {};
      curVegaSpec["encoding"]["x"]["scale"]["domain"] = [minVal - marg, maxVal + marg];
      refresh = true;
    }
  }
  if (refresh) {
    (document.getElementById("vega_spec")as HTMLInputElement).value = JSON.stringify(curVegaSpec).replace(/,\"/g,",\n\"");
    updatePlot("vegaWork");
  }
}
// Sidebar
function openNav() {
  document.getElementById("data").style.width = "450px";
  document.getElementById("main").style.marginLeft = "450px";
}

/* Set the width of the sidebar to 0 and the left margin of the page content to 0 */
function closeNav() {
  document.getElementById("data").style.width = "0";
  document.getElementById("main").style.marginLeft = "0";
}
document.getElementById('openDataBtn').addEventListener("click", openNav);
document.getElementById('closeDataBtn').addEventListener("click", closeNav);

//

document.getElementById('draco_reason').addEventListener("click", reason_plot);
document.getElementById('build_graph').addEventListener("click", ()=>{updatePlot("vegaWork"); updatePlot("vegaInit")});

document.getElementById('addGrid').addEventListener("click", addGrid);
document.getElementById('brightBackground').addEventListener("click", brightBackground);
document.getElementById('neutralBackground').addEventListener("click", neutralBackground);
document.getElementById('addStars').addEventListener("click", addStars);
document.getElementById('cutAxis').addEventListener("click", cutAxis);
init_draco();