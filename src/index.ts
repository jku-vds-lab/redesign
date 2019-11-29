import './style.scss'; // import styles as described https://github.com/webpack-contrib/sass-loader
import Draco from 'draco-vis';
import embed from 'vega-embed';

document.title = 'Redesign';
document.getElementById('heading').textContent = 'Hello World!'
console.log('test')

const runDraco = async () => {
  //Copied from observable:
  // initialize draco with the clingo webassembly module
  const draco = await (new Draco()).init()
  const result = draco.solve(`
    % ====== Data definitions ======
    data("https://vega.github.io/editor/data/cars.json").
    num_rows(142).
    
    fieldtype("Horsepower",number).
    cardinality("Horsepower",94).
    
    fieldtype("Acceleration",number).
    cardinality("Acceleration",96).
    
    % ====== Query constraints ======
    encoding(e0).
    :- not field(e0,"Acceleration").
    
    encoding(e1).
    :- not field(e1,"Horsepower").
  `)
  console.log(result.result.Time.Solve)
}

// runDraco();

embed('#vega', {
  "$schema": "https://vega.github.io/schema/vega-lite/v4.json",
  "description": "A scatterplot showing horsepower and miles per gallons for various cars.",
  "data": {"url": "https://vega.github.io/editor/data/cars.json"},
  "mark": "point",
  "encoding": {
    "x": {"field": "Horsepower", "type": "quantitative"},
    "y": {"field": "Miles_per_Gallon", "type": "quantitative"}
  }
});