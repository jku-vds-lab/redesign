import './style.scss'; // import styles as described https://github.com/webpack-contrib/sass-loader
import Draco from 'draco-vis';
import embed from 'vega-embed';
import * as d3_fetch from 'd3-fetch';
import { Dict } from 'vega-lite/build/src/util';
import { JsonDataFormat } from 'vega-lite/build/src/data';


document.title = 'Redesign';
document.getElementById('heading').textContent = 'Draco Testbench';
const dracoQuery: HTMLTextAreaElement = (document.getElementById("draco_query") as HTMLTextAreaElement)
dracoQuery.value = ` % ====== Data definitions ======
data("parties.json").
num_rows(6).

fieldtype("count",number).
cardinality("count",6).

fieldtype("party",string).
cardinality("party",6).

% ====== Query constraints ======
encoding(e0).
:- not field(e0,"count").

encoding(e1).
:- not field(e1,"party").`;
let draco_instance: Draco;
let dataOptions: string | any[];
let data;

const init_draco = async () => {
  draco_instance = await (new Draco().init());
  let dataSelector = (document.getElementById('selectData') as HTMLSelectElement);

  dataOptions = ["---","cars.json", "parties.json"];
  
  console.log(dataOptions);
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
              let res: any;
              clearFieldCheckBoxes();
              if (newIndex != 0){
                fetch(dataOptions[dataSelector.selectedIndex])
                  .then(response => response.json())
                  .then(json => data = json).then( a => {
                    draco_instance.prepareData(data);
                    res = draco_instance.getSchema();
                    setFieldCheckBoxes(res);
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
}

/*
Given a schema (Data summary, made by draco.prepareData, draco.getSchema)
populates the 'fields' form with checkboxes, corresponding to the fields
of the dataset;
*/
const setFieldCheckBoxes = (schema: any) => {
  let flds = document.getElementById('fields');
  let currentFields = Object.keys(schema.stats)

  console.log(draco_instance.getSchema().stats, currentFields);

  flds.innerHTML = "Available fields:<br>";
  for(let i = 0; i < currentFields.length; i++){
    let box = document.createElement("INPUT");
    let box_id = "field_"+currentFields[i];
    box.setAttribute("type","checkbox");
    box.setAttribute("value", "0");
    box.setAttribute("id", box_id);

    let label = document.createElement("LABEL");
    //label.setAttribute("type", "label");
    label.setAttribute("for", box_id);
    label.innerHTML = " "+currentFields[i];

    let br = document.createElement("br");

    flds.appendChild(box);
    flds.appendChild(label);
    flds.appendChild(br);
  }
}

const reason_plot = () => {
  const result = draco_instance.solve((document.getElementById("draco_query") as HTMLTextAreaElement).value);
  console.log("Specification solved: ",result);
  let softCons = "";
  for (let i=0; i<(result.models[0].violations).length; i++){
    let curViolation = result.models[0].violations[i];
    softCons += curViolation.description + " weight: " + curViolation.weight + "<br>";
  }
  document.getElementById('soft_con').innerHTML = softCons;
  embed('#vega',result.specs[0]);
}

document.getElementById('draco_reason').addEventListener("click", reason_plot);
init_draco();
console.log('this is brushed')

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