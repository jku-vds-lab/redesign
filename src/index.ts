import './style.scss'; // import styles as described https://github.com/webpack-contrib/sass-loader
import {Effector} from './effects';
import Draco from 'draco-vis';
import embed from 'vega-embed';
import * as $ from 'jquery';

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
let numAvailableEffects: number;

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
                fetchDataset(dataOptions[dataSelector.selectedIndex])
                  .then(json => data = json).then( () => {
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

const fetchDataset = async (path) => {
  let res: any;
  await fetch(path).then(response => response.json())
            .then(json => {res = json});
  return res;
}
/*
Clears 'fields' (to be used when a new dataset is selected or
when the old one deselected);
*/
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
const init_plots = async (fromData = true) => {

  if (fromData) {
    let draco_spec = generateDRACOSpecification();
    let number_of_models = 1;
    currentResult = draco_instance.solve(draco_spec,{"models":number_of_models});
    curVegaSpec = currentResult.specs[0];
    (document.getElementById("vega_spec") as HTMLInputElement).value = JSON.stringify(curVegaSpec).replace(/,\"/g,",\n\"");
  } else {
    curVegaSpec = JSON.parse((document.getElementById("vega_spec")as HTMLInputElement).value);
    const dataURL = curVegaSpec["data"]["url"];
    await fetchDataset(dataURL).then(json => data = json).then(()=> {
                    console.log(data);
                    draco_instance.prepareData(data);
                    dataSummary = draco_instance.getSchema();
    // TODO: reset dataset combobox and checkboxes to initial undefined state!!!
    })
  }
  effector = undefined;
  specInit = curVegaSpec;
  //
  updatePlot("#vegaInit", curVegaSpec)
    .then(()=>{
      document.getElementById("vegaInit").hidden = true;
    })
    .then(()=>{
  effector = new Effector(specInit, dataSummary, fromData);
  availableEffects = effector.getEffects();
  curVegaSpec = effector.getCurrentSpec();
  updatePlot("#vegaInit", curVegaSpec);
  updatePlot("#vegaWork", curVegaSpec);
  //
  console.log(effector, curVegaSpec);

  document.getElementById("ZeroBox").hidden = true;
  document.getElementById("ColorSeqNominalBox").hidden = true;
  document.getElementById("OverplottingTranspBox").hidden = true;
  document.getElementById("WallpaperBox").hidden = true;
  document.getElementById("RoundBarsBox").hidden = true;

  numAvailableEffects = Object.keys(availableEffects).length;
  initGoodometer(numAvailableEffects);
  const score = effector.currentScore;
  updateScore(score, "L");
  updateScore(score, "R");
  updateFeedback("", score, effector.currentScore , effector.maxScore);

  if (availableEffects.hasOwnProperty("Zero")) {
    document.getElementById("ZeroBox").hidden = false;
    (document.getElementById("Zero") as HTMLInputElement).checked = availableEffects["Zero"]["on"];
  }
  //ColorSeqNominal
  if (availableEffects.hasOwnProperty("ColorSeqNominal")) {
    document.getElementById("ColorSeqNominalBox").hidden = false;
    (document.getElementById("ColorSeqNominal") as HTMLInputElement).checked = availableEffects["ColorSeqNominal"]["on"];
  }
  if (availableEffects.hasOwnProperty("OverplottingTransp")) {
    document.getElementById("OverplottingTranspBox").hidden = false;
    (document.getElementById("OverplottingTransp") as HTMLInputElement).checked = availableEffects["OverplottingTransp"]["on"];
  }
  if (availableEffects.hasOwnProperty("Wallpaper")) {
    document.getElementById("WallpaperBox").hidden = false;
    (document.getElementById("Wallpaper") as HTMLInputElement).checked = availableEffects["Wallpaper"]["on"];
  }
  if (availableEffects.hasOwnProperty("RoundBars")) {
    document.getElementById("RoundBarsBox").hidden = false;
    (document.getElementById("RoundBars") as HTMLInputElement).checked = availableEffects["RoundBars"]["on"];
  }
  });
}

/* VEGA */
const updatePlot = async (vegaId : string, spec = curVegaSpec) => {
  await embed(vegaId, spec, {"renderer":"svg"});
  //await embed(vegaId, spec);
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

document.getElementById('generateFromData').addEventListener("click", ()=>{init_plots(true)});
document.getElementById('generateFromSpec').addEventListener("click", ()=>{init_plots(false)});

document.getElementById('Zero').addEventListener("click", ()=>{effectClick("Zero")});
document.getElementById('ColorSeqNominal').addEventListener("click", ()=>{effectClick("ColorSeqNominal")});
document.getElementById('OverplottingTransp').addEventListener("click", ()=>{effectClick("OverplottingTransp")});
document.getElementById('Wallpaper').addEventListener("click", ()=>{effectClick("Wallpaper")});
document.getElementById('RoundBars').addEventListener("click", ()=>{effectClick("RoundBars")});

function effectClick(effect : string) {
  let msg : string;
  const oldScore = effector.currentScore;
  if ((document.getElementById(effect)as HTMLInputElement).checked) msg = effector.activateEffect(effect);
  else msg = effector.deactivateEffect(effect);
  updateFeedback(msg, oldScore, effector.currentScore , effector.maxScore);
  curVegaSpec = effector.getCurrentSpec();
  updatePlot("#vegaWork", curVegaSpec);
  updateScore(effector.currentScore, "R");
}

// GoodOMeter
function initGoodometer(numEffects : number) {
  const ggrid = document.getElementById("goodometer");
  ggrid.innerHTML="";

  for(let i=0; i <= numEffects; i++){
    let left = document.createElement("div");
    let middle = document.createElement("div");
    let right = document.createElement("div");

    left.setAttribute("class", "grid-item")
    middle.setAttribute("class", "grid-item")
    right.setAttribute("class", "grid-item")
   
    const red = 79 + i/numEffects*(254 - 79);
    const green = 183 + i/numEffects*(224 - 183);
    const blue = 104 + i/numEffects*(139 - 104);
    //153,213,148 254,224,139
   /*  const red = 49 + i/numEffects*(229 - 49);
    const green = 163 + i/numEffects*(245 - 163);
    const blue = 84 + i/numEffects*(224 - 84);
 */
    const bgcolor = "rgb(" + red + "," + green + "," + blue + ")";

    middle.style.backgroundColor = bgcolor;

    if (i == 0)
      middle.innerHTML = "Best";
    else if (i == numEffects)
      middle.innerHTML = "Worst";
    else {
      middle.innerHTML = "o";
      middle.style.color = bgcolor;
    }

    right.setAttribute("id","Rscore-" + (numEffects - i));
    left.setAttribute("id","Lscore-" + (numEffects - i));

    ggrid.appendChild(left);
    ggrid.appendChild(middle);
    ggrid.appendChild(right);
  }
}

function updateScore(newScore: number, prefix = "R") {
  for(let i = 0; i <= numAvailableEffects; i++) {
    const el = document.getElementById(prefix+"score-"+i);
    if (i == newScore) {
      if (prefix == "R")
        el.innerHTML = "← Yours";
      else
        el.innerHTML = "Initial →";
    }
    else el.innerHTML = "";
  }
}
function updateFeedback(message : string, oldScore : number,  score : number, maxScore : number){
  if (oldScore > score) {
    //color => "rgb(254,224,139)";
    $("#feedback-container").toggleClass("red");
    setTimeout(()=>{$("#feedback-container").toggleClass("red");}, 600);
  }
  else if (oldScore < score) {
    //color => "rgb(109,193,124)";
    $("#feedback-container").toggleClass("green");
    setTimeout(()=>{$("#feedback-container").toggleClass("green");}, 600);
  }
  const fbk = (document.getElementById("feedback"));
  fbk.innerHTML = score+" out of "+ maxScore + " guessed correctly!<br><br>"+message;
}

//init_draco();
(document.getElementById("vega_spec") as HTMLInputElement).value = '{"$schema"\:"https://vega.github.io/schema/vega-lite/v3.json"\,"data"\:{"url"\:"cars.json"}\,"mark"\:"circle"\,"encoding"\:\{\n      "color"\:\{"type"\:"nominal"\,"field":"Origin"\,\n                    "scale"\:\{"scheme"\:"bluepurple"\}\}\,\n      "x"\:\{"type"\:"quantitative"\,\n             "field"\:"Weight_in_lbs"}\,\n      "y"\:{"type"\:"quantitative"\,\n             "field"\:"Horsepower"\,\n             "scale"\:{"zero"\:true\}\}\}\}';
init_draco().then(() => {
   init_plots(false);
})
