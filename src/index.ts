import './style.scss'; // import styles as described https://github.com/webpack-contrib/sass-loader
import Draco from 'draco-vis';
import embed from 'vega-embed';
import * as d3_fetch from 'd3-fetch';


document.title = 'Redesign';
document.getElementById('heading').textContent = 'Draco Testbench';
let draco_instance: Draco;
let dataOptions: string | any[];

let data: any[];
let currentFields: string | any[];
let dataSummary: any;
let dataSetIndex = 0;

let currentEncodings = {};
let currentViolationsSummary: {};
let currentResult: any;

const init_draco = async () => {
  draco_instance = await (new Draco().init());
  let dataSelector = (document.getElementById('selectData') as HTMLSelectElement);

  dataOptions = ["---","cars.json", "parties.json"];
  
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
  //const result = draco_instance.solve((document.getElementById("draco_query") as HTMLTextAreaElement).value);
  let number_of_models = (document.getElementById('n_models')as HTMLInputElement).value as unknown as number;
  const result = draco_instance.solve(spec,{"models":number_of_models});
  console.log("Specification solved: ",result);
  let softCons = "";
  for (let i=0; i<(result.models[0].violations).length; i++){
    let curViolation = result.models[0].violations[i];
    softCons += curViolation.description + " weight: " + curViolation.weight + "<br>";
  }
  formatRules(result);
  //let sortedViolations = displayViolations(false);
  //document.getElementById('soft_con').innerHTML = softCons;
  //document.getElementById('soft_con').innerHTML = sortedViolations;
  currentResult = result;
  updateLeft();
  updateRight();
}
/* VEGA */
const updateLeft = () => {
  let index = (document.getElementById("index_left")as HTMLInputElement).value as unknown as number;
  embed('#vega_left',currentResult.specs [index]);
  document.getElementById('vis_left_header').innerHTML = "Vis #"+ index as string + "; Weight: " + currentResult.models[index].costs as string;
}
const updateRight = () => {
  let index = (document.getElementById("index_right")as HTMLInputElement).value as unknown as number;
  embed('#vega_right',currentResult.specs [index]);
  document.getElementById('vis_right_header').innerHTML = "Vis #"+ index as string + "; Weight: " + currentResult.models[index].costs as string;

}

/* 
Gather Violations
*/
const formatRules = (dracoOut :  any) => {
  let sortedViolatons = {};
  let enc_list = Object.keys(currentEncodings);
  enc_list.push("other");
  currentEncodings["other"] = {"type":"unknown", "name":"other"};
  for (let i=0; i<(enc_list).length; i++){
    sortedViolatons[enc_list[i]] = new Array;
  }
  for (let i=0; i<(dracoOut.models[0].violations).length; i++){
    let curViolation = dracoOut.models[0].violations[i];
    let curEncoding = ((curViolation.witness as string).match(/,(.*)\)/)[1] as string);
    if (!enc_list.includes(curEncoding)) {
      curEncoding = "other";
    }
    sortedViolatons[curEncoding].push({ desc: (curViolation.description as string),
                                        weight: (curViolation.weight as number)});
  }
  currentViolationsSummary = sortedViolatons;
  return(sortedViolatons);
}
/*
Display Violations
*/
const displayViolations = (zeros: boolean = true) => {
let headers = Object.keys(currentViolationsSummary);
let resHTML = "";
for(let i=0; i<headers.length ; i++){
  let curEncoding = headers[i] as string;
  let violations = currentViolationsSummary[curEncoding];
  if (violations.length < 1) continue;
  resHTML += "<h3>" + "field " + currentEncodings[curEncoding]["name"] + ":</h3><ul>"
  for (let j=0; j<violations.length; j++){
    if ((violations[j].weight == 0) && !zeros) continue;
    resHTML += "<li> " + violations[j]["desc"] + "[" + violations[j].weight +"];</li>";
  }
  resHTML += "</ul>";
}
return resHTML;
}

document.getElementById('draco_reason').addEventListener("click", reason_plot);
init_draco();
document.getElementById('index_left').addEventListener("change", updateLeft);
document.getElementById('index_right').addEventListener("change", updateRight);

/*embed('#vega', {
  "$schema": "https://vega.github.io/schema/vega-lite/v4.0.0-beta.12.json",
  "description": "A scatterplot showing horsepower and miles per gallons for various cars.",
  "data": {"url": "https://vega.github.io/editor/data/cars.json"},
  "mark": "point",
  "encoding": {
    "x": {"field": "Horsepower", "type": "quantitative"},
    "y": {"field": "Miles_per_Gallon", "type": "quantitative"}
  }
});
*/