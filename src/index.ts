import './style.scss'; // import styles as described https://github.com/webpack-contrib/sass-loader
import Draco from 'draco-vis';
import embed from 'vega-embed';
import {costsDict} from './costsDictionary';
import * as tsnejs from './tsne';
import * as d3 from 'd3';

document.title = 'Graph Destroyer';
document.getElementById('heading').textContent = 'Graph Destroyer';
let draco_instance: Draco;
let dataOptions: string | any[];

let data: any[];
let currentFields: string | any[];
let dataSummary: any;
let dataSetIndex = 0;

let currentEncodings = {};
let currentViolationsSummary: {};
let currentResult: any;

let currentVectors = [];

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
  //const result = draco_instance.solve((document.getElementById("draco_query") as HTMLTextAreaElement).value);
  //let number_of_models = (document.getElementById('n_models')as HTMLInputElement).value as unknown as number;
  let number_of_models = 1;
  currentResult = draco_instance.solve(spec,{"models":number_of_models});
  console.log("Specification solved: ",currentResult);
  
  //formatRules(currentResult);
  //let sortedViolations = displayViolations(false);
  //document.getElementById('soft_con').innerHTML = softCons;
  //document.getElementById('soft_con').innerHTML = sortedViolations;
  //updateLeft();
  //updateRight();
  (document.getElementById("vega_spec")as HTMLInputElement).value = JSON.stringify(currentResult.specs[0]);
 // (document.getElementById("index_right")as HTMLInputElement).max = (number_of_models - 1) as unknown as string ;
  /* exporting visual Embeddings */
  exportVisualEmbeddings();
}
/* VEGA */
const updateLeft = () => {
  let index = (document.getElementById("index_left")as HTMLInputElement).value as unknown as number;
  embed('#vega_left',currentResult.specs [index]);
  document.getElementById('vis_left_header').innerHTML = "Vis #"+ index as string + "; Cost: " + currentResult.models[index].costs as string;
}
const updateRight = () => {
  let spec = JSON.parse((document.getElementById("vega_spec")as HTMLInputElement).value);
  embed('#vega_right',spec);
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

const exportVisualEmbeddings = () => {
  currentVectors = [];
  const numberOfSelectedFields = Object.keys(currentEncodings).length - 1; // (-1 because of default <other> encoding)
  const spaceCardinality = Object.keys(costsDict).length * (numberOfSelectedFields);
  const enc_list = Object.keys(currentEncodings);
  const violationsArray = Object.keys(costsDict);
  console.log("Vector Space Cardinality (#soft constraints times #number of fields): ",spaceCardinality);
  console.log("Number of fields selected: ", numberOfSelectedFields, enc_list);
  /*
  === Clarification! ===
  currentEncodings - contains mapping from data fields to encodings (entities representing data on screen)
  encodings are e0, e1, ... how many? exactly how many fields have been selected;
  there is also a special "encoding" <other> which is an artificial entity for easier sorting of violations
  (for violations which do not relate to an encoding, but to the whole plot);
  we do not consider <other> for building a feature vector. In our vector we have one element for each
  combintaion: {violation_i + encoding_j};
  this means that if we have 2 encodings (or fields selected) for violation with number k,
  that is applied to the whole plot, we will have 2 identical values in our vector, one for each encoding;
  */  
  if (currentResult.models.length > 1000) {
    alert("Prevented attempted to produce more than 1000 vector embeddings. Remove this restriction in the code.");
    return;
  }
  currentResult.models.forEach((model: { violations: any[]; }) => {
    let curVector = new Array(spaceCardinality).fill(0);
    model.violations.forEach(violation => {
      // figure violation index
      const violationIndex = violationsArray.lastIndexOf(violation["name"]+"_weight");
      // figure encoding index
      let curEncoding = ((violation.witness as string).match(/,(.*)\)/)[1] as string);
      let encodingIndices = [];
      if (!enc_list.includes(curEncoding)) {
        for(let i = 0; i < numberOfSelectedFields; i++){
          encodingIndices.push(i);
        }
      }
      else {
        encodingIndices.push(+curEncoding.substring(1));
      }
      // figure cost of violation
      const cost = +costsDict[violation.name + "_weight"];
      encodingIndices.forEach(index => {
        curVector[index * (Object.keys(costsDict).length) + violationIndex] = cost;
      })
    });
    currentVectors.push(curVector);
    //console.log(curVector);
    //console.log(arrSum(curVector));
  });
  console.log(currentVectors);
  // T-SNE
  const opt = {
    "epsilon" : 10, // epsilon is learning rate (10 = default)
    "perplexity" : 30, // roughly how many neighbors each point influences (30 = default)
    "dim" : 2 // dimensionality of the embedding (2 = default)
  };

  let tsne = new tsnejs.tSNE(opt); // create a tSNE instance
  tsne.initDataRaw(currentVectors);
  for(let k = 0; k < 500; k++) {//!!!!
    tsne.step(); // every time you call this, solution gets better
  }
  //
  //
  //
  //
  ///
//
  //
  const Y0 = tsne.getSolution();
  //Y = [[1,1], [2,5], [4,3], [1.5,1.5]];
  ///

  ///
  //
  //
  //
  //
  console.log(Y0);
  //ADDING COSTS TO T-SNE VECTOR OUTPUT
  let Y = [];
  for (let i=0; i<Y0.length; i++){
    Y.push({"x":Y0[i][0],"y":Y0[i][1],"cost": currentResult.models[i].costs[0],"index":i});}
  console.log(Y);


  // plotting
  const margin = {top: 30, right: 30, bottom: 30, left: 30};
  const width = 250 - margin.left - margin.right;
  const height = 250 - margin.top - margin.bottom;

  d3.select("#t_sne_plot").select("svg").remove();
  let svg = d3.select("#t_sne_plot")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
// setup x 
    const maxX = d3.max(Y, function(d) { return +d.x;} );
    const minX = d3.min(Y, function(d) { return +d.x;} );
    let xScale = d3.scaleLinear()
      .domain([minX,maxX])
      .range([0,width]);
    let xAxis = d3.axisTop(xScale);
    const xMap = function(d) { return xScale(d.x);}

    svg.append("g")
      .attr("class", "x axis")
      .call(xAxis)
// setup y

    const maxY = d3.max(Y, function(d) { return +d.y;} );
    const minY = d3.min(Y, function(d) { return +d.y;} );
    let yScale = d3.scaleLinear()
      .domain([minY,maxY])
      .range([0,height]);
    let yAxis = d3.axisLeft(yScale);
    const yMap = function(d) { return yScale(d.y);}

    svg.append("g")
      .attr("class", "y axis")
      .call(yAxis);

      let tooltip = d3.select("body").append("div")
      .attr("class", "tooltip")
      .style("opacity", 0);

  svg.selectAll("circle")
  .data(Y)
  .enter()
  .append("circle")
  .attr("cx", xMap)
  .attr("cy", yMap)
  .attr("r", 4)
  .attr("fill", "steelblue")
  .on("mouseover", function(d) {
    tooltip.transition()
         .duration(200)
         .style("opacity", .9);
    tooltip.html("Cost: "+d.cost+"<br>Index: "+d.index)
         .style("left", (d3.event.pageX + 5) + "px")
         .style("top", (d3.event.pageY - 28) + "px");})
  .on("mouseout", function(d) {
    tooltip.transition()
         .duration(500)
         .style("opacity", 0);})
  .on("click", function(d){
    (document.getElementById("index_left")as HTMLInputElement).value = d.index as unknown as string;
    updateLeft();
  });
//*/
console.log("X:", minX, maxX,"\nY:",minY, maxY);
}   

document.getElementById('draco_reason').addEventListener("click", reason_plot);
document.getElementById('build_graph').addEventListener("click", updateRight);
//document.getElementById('index_left').addEventListener("change", updateLeft);
//document.getElementById('index_right').addEventListener("change", updateRight);

init_draco();

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