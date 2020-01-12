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
console.log('test0')

const runDraco = async () => {
  console.log('RunDraco')
  // initialize draco with the clingo webassembly module
  const draco = await (new Draco()).init()
  console.log(draco);
 // console.log(">>>",document.getElementById("draco_query").textContent);
  const result = draco.solve(dracoQuery.value);
  console.log("SOLVED!>",result);
  let softCons = "";
  for (let i=0; i<(result.models[0].violations).length; i++){
      let curViolation = result.models[0].violations[i];
      softCons += curViolation.description + " weight: " + curViolation.weight + "<br>";
  }
  console.log(softCons);
  document.getElementById('soft_con').innerHTML = softCons;
  embed('#vega',result.specs[0]);
}

//runDraco();
document.getElementById('draco_launch').addEventListener("click", runDraco);
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

`
 % ====== Data definitions ======
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
 :- not field(e1,"party").
`*/