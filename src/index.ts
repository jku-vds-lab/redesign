import './style.scss'; // import styles as described https://github.com/webpack-contrib/sass-loader
import Draco from 'draco-vis';
import embed from 'vega-embed';

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

const init_draco = async () => {
  draco_instance = await (new Draco().init());
  let dataSelector = (document.getElementById('selectData') as HTMLSelectElement);

  dataOptions = ["---","cars.csv", "parties.csv"];
  
  console.log(dataOptions);
  for (let i = 0; i < dataOptions.length; i++){
    let option = document.createElement("option");
    option.text = dataOptions[i];
    dataSelector.add(option);
  }

  dataSelector.addEventListener("change", function(){console.log(dataSelector.selectedIndex)});

  dataSelector.disabled = false;
  (document.getElementById('draco_reason') as HTMLButtonElement).disabled = false;
} 

const readCSVasJSON = () => {
  
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