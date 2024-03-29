import './style.scss'; // import styles as described https://github.com/webpack-contrib/sass-loader
import {Effector} from './effects';
import Draco from 'draco-vis';
import embed from 'vega-embed';
import * as $ from 'jquery';
import { randomNormal } from 'd3';

document.title = 'GraphTrain';

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

let samplingUnlocked = false;
let samplingTried = false;
let firstLaunch = true;

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
  if (samplingUnlocked) effector.unlockSampling();
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
  (document.getElementById("Sampling") as HTMLInputElement).checked = false;

  numAvailableEffects = effector.maxScore;
  initGoodometer(numAvailableEffects);
  const score = effector.currentScore;
  updateScore(score, "L");
  updateScore(score, "R");
  // feedback
  $("#feedback-container").removeClass("red green pale-green pale-red")
  updateFeedback("", score, effector.currentScore , effector.maxScore, true);

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
  if (availableEffects.hasOwnProperty("Sampling")) {
    document.getElementById("SamplingBox").hidden = false;
    (document.getElementById("Sampling") as HTMLInputElement).checked = availableEffects["Sampling"]["on"];
  }
  });
}

/* VEGA */
const updatePlot = async (vegaId : string, spec = curVegaSpec) => {
  await embed(vegaId, spec, {"renderer":"svg", "actions": false});
  //await embed(vegaId, spec);
}
// Sidebar
function openNav() {
  $(".middle_container").css("transition","opacity 0.5s ease-in-out");
  document.getElementById("data").style.width = "28%";
  setTimeout(()=>{$(".middle_container").css("opacity",1);},310);
}
/* Set the width of the sidebar to 0 and the left margin of the page content to 0 */
function closeNav() {
  $(".middle_container").css("opacity",0);
  setTimeout(()=>{document.getElementById("data").style.width = "0";},510);
}




//document.getElementById('openDataBtn').addEventListener("click", openNav);
document.getElementById('closeDataBtn').addEventListener("click", closeNav);

document.getElementById('generateFromData').addEventListener("click", ()=>{init_plots(true)});
document.getElementById('generateFromSpec').addEventListener("click", ()=>{init_plots(false)});

document.getElementById('Zero').addEventListener("click", ()=>{effectClick("Zero")});
document.getElementById('ColorSeqNominal').addEventListener("click", ()=>{effectClick("ColorSeqNominal")});
document.getElementById('OverplottingTransp').addEventListener("click", ()=>{effectClick("OverplottingTransp")});
document.getElementById('Wallpaper').addEventListener("click", ()=>{effectClick("Wallpaper")});
document.getElementById('RoundBars').addEventListener("click", ()=>{effectClick("RoundBars")});
document.getElementById('Sampling').addEventListener("click", ()=>{
  const effect = 'Sampling';
  let msg : string;
  const oldScore = effector.currentScore;
  if ((document.getElementById(effect)as HTMLInputElement).checked) {
    /*if (!samplingTriedfalse) {
      effector.deactivateEffect("OverplottingTransp");
      (document.getElementById("OverplottingTransp")as HTMLInputElement).checked = false;
      samplingTried = true;
    }*/
    msg = effector.activateEffect(effect);
  }
  else msg = effector.deactivateEffect(effect);
  updateFeedback(msg, oldScore, effector.currentScore , effector.maxScore);
  curVegaSpec = effector.getCurrentSpec();
  updatePlot("#vegaWork", curVegaSpec);
  updateScore(effector.currentScore, "R");
});

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
    if (firstLaunch) right.setAttribute("class", "grid-item right")
    else right.setAttribute("class", "grid-item")
   
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
        //el.innerHTML = "← Current";
        el.innerHTML = "←Yours ";
      else
        //el.innerHTML = "Starting →";
        el.innerHTML = "Start →";
    }
    else el.innerHTML = "";
  }
}

function updateFeedback(message : string, oldScore : number,  score : number, maxScore : number, initial = false){
  let cheer = "";
  if (oldScore > score) {
    //color => "rgb(254,224,139)";
    $("#feedback-container").removeClass("red green pale-green pale-red").toggleClass("red");
    setTimeout(()=>{$("#feedback-container").toggleClass("pale-red").removeClass("red")}, 600);
  }
  else if (oldScore <= score) {
    cheer += "keep it up, ";
    //color => "rgb(109,193,124)";
    $("#feedback-container").removeClass("red green pale-green pale-red").toggleClass("green");
    setTimeout(()=>{$("#feedback-container").toggleClass("pale-green").removeClass("green");}, 600);
  }
  const fbk = (document.getElementById("feedback"));

  if (initial) cheer = "are correct, but why?";
  else
    if ((maxScore - score) == 1) cheer += "almost there!";
    else
      if (score == maxScore) cheer = "full house!";
      else
        if (score == 1) cheer += "it is not the worst."
        else {
          cheer += "still a way to go!";
        }
  // 
  let warn = "";
  if (samplingUnlocked &&
    (document.getElementById("Sampling") as HTMLInputElement).checked &&
    (document.getElementById("OverplottingTransp") as HTMLInputElement).checked) {
      $("#OverplottingTranspSubBox").addClass("yellow");
      $("#SamplingBox").addClass("yellow");
      warn = "<br><br><div class=\"sub-effect yellow\">Using Sampling and Low Marks Opacity together would require to manually adjust sampling rate and opacity value.<br>Otherwise your plot may lack definition.</div>";
    }
  else {
    $("#OverplottingTranspSubBox").removeClass("yellow");
    $("#SamplingBox").removeClass("yellow");
  }
  fbk.innerHTML = score+" out of "+ maxScore + " - "+cheer+"<br><br>"+message+warn;
  // dealing with bonus effects //
  if (message.includes("SamplingBonus")) {
    let el = document.getElementById("SamplingBonus");
    el.onclick = ()=>{
      if (!availableEffects.hasOwnProperty("Sampling")) {
        effector.unlockSampling();
        samplingUnlocked = true;
        availableEffects = effector.getEffects();
        numAvailableEffects = effector.maxScore;
        /*initGoodometer(numAvailableEffects);
        const score = effector.calculateCurrentScore();
        updateScore(score, "L");
        updateScore(score, "R");*/
      }
      document.getElementById("SamplingBox").hidden = false;
      $("#SamplingBox").addClass("green");
      setTimeout(()=>{$("#SamplingBox").removeClass("green");}, 600);
      return false;
    }
  }
}

$(document).on("keypress",(event) => {
  firstLaunch = false;
  quickStart();});

(document.getElementById("vega_spec") as HTMLInputElement).value = '{"$schema"\:"https://vega.github.io/schema/vega-lite/v3.json"\,"data"\:{"url"\:"cars.json"}\,"mark"\:"circle"\,"encoding"\:\{\n      "color"\:\{"type"\:"nominal"\,"field":"Origin"\,\n                    "scale"\:\{"scheme"\:"bluepurple"\}\}\,\n      "x"\:\{"type"\:"quantitative"\,\n             "field"\:"Weight_in_lbs"}\,\n      "y"\:{"type"\:"quantitative"\,\n             "field"\:"Horsepower"\,\n             "scale"\:{"zero"\:true\}\}\}\}';
init_draco().then(() => {
   init_plots(false);
}).then(()=>{
  $("#vegaWork").hide();
  if (!firstLaunch) {quickStart(); return;}
  $(".sidebar").css("opacity",1);
  $("#heading").css("transition", "opacity 1s ease-in-out");
  $("#container-init").css("transition", "opacity 1s ease-in-out");
  $("#subtext").css("transition", "opacity 1s ease-in-out");
  setTimeout(()=>{$("#container-init").css("opacity",1);}, 600);
  setTimeout(()=>{$("#heading").css("opacity",1);}, 1800);
  setTimeout(()=>{$("#subtext").css("opacity",1);}, 3200);
  $("#global_div").on("click",
                ()=>{
                      if (!firstLaunch) {quickStart(); return;}
                      $("#subtext").css("opacity",0);
                      smoothTextChange("We think it could be better...");
                      setTimeout(()=>{
                        $("#meter-container").css("transition", "opacity 2.0s ease-in-out");
                        $("#meter-container").css("opacity",1);
                        setShowYours();
                      },1900);
                      setTimeout(()=>{$("#subtext").css("opacity",1);}, 3500);
                    }); 
});

function setShowYours() {
  if (!firstLaunch) {quickStart(); return;}
  $("#global_div").off();
  $("#global_div").on("click",
                        ()=>{
                          if (!firstLaunch) {quickStart(); return;}
                          $("#subtext").css("opacity",0);
                          smoothTextChange("Set off on a journey to ...");
                          $("#vegaWork").show();
                          setTimeout(()=>{
                            $(".grid-item.right").css("transition", "opacity 2.0s ease-in-out");
                            $(".grid-item.right").css("opacity",1);
                            $("#current").css("transition", "opacity 2.0s ease-in-out");
                            $("#current").css("opacity",1);
                            setShowEffects();
                          },2200);
                          setTimeout(()=>{$("#subtext").css("opacity",1);}, 3500);
                        }
                      );
}

function setShowEffects() {
  if (!firstLaunch) {quickStart(); return;}
  $("#global_div").off();
  $("#global_div").on("click",
                        ()=>{
                          if (!firstLaunch) {quickStart(); return;}
                          $("#subtext").css("opacity",0);
                          smoothTextChange("... discover the space of possibilities");
                          setTimeout(()=>{
                            $("#subtext").html("Play with this visualization or explore <a href=\"no-javascript.html\" id=\"openDataBtn\">your own</a>.");
                            $("#effects-div").css("transition", "opacity 2.0s ease-in-out");
                            $("#effects-div").css("opacity",1);
                          },2200);
                          setTimeout(()=>{
                            document.getElementById('openDataBtn').onclick = ()=> {openNav(); return false;};
                            $("#subtext").css("opacity",1);
                          },3600);
                          setTimeout(()=>{
                            smoothTextChange("Institute of Computer Graphics, Johannes Kepler University Linz, Austria, 2020",".footer");
                          },4200);
                            $("#global_div").off();
                            $(document).off();
                            firstLaunch = false;
                        }
                      )
}

function smoothTextChange(msg : string, id = "#heading"){
  $(id).css("opacity",0);
  setTimeout(()=>{$(id).html(msg);},1100);
  setTimeout(()=>{$(id).css("opacity",1);},1100);
}

function quickStart(){
  $("#global_div").off();

  $("#subtext").css("opacity",0);
  smoothTextChange("... discover the space of possibilities");
  $("#container-init").css("opacity",1);

  $("#meter-container").css("transition", "opacity 2.0s ease-in-out");
  $("#meter-container").css("opacity",1);

  setTimeout(()=>{
    $("#subtext").html("Play with this visualization or explore <a href=\"no-javascript.html\" id=\"openDataBtn\">your own</a>.");
    $("#effects-div").css("transition", "opacity 2.0s ease-in-out");
    $("#effects-div").css("opacity",1);
  },1000);
  setTimeout(()=>{
    document.getElementById('openDataBtn').onclick = ()=> {openNav(); return false;};
    $("#subtext").css("opacity",1);
  },1200);

  $("#vegaWork").show();
  $(".grid-item.right").css("transition", "opacity 2.0s ease-in-out");
  $(".grid-item.right").css("opacity",1);
  $("#current").css("transition", "opacity 2.0s ease-in-out");
  $("#current").css("opacity",1);

  setTimeout(()=>{
    smoothTextChange("Institute of Computer Graphics, Johannes Kepler University Linz, Austria, 2021",".footer");
  },1500);
  $("#global_div").off();
  $(document).off();
}

/*
{"$schema":"https://vega.github.io/schema/vega-lite/v3.json",
"data":{"url":"parties.json"},
"mark":"bar",
"encoding":{"y":{"type":"ordinal",
"field":"party"},
"color":{"type":"nominal", "field":"party", "scale":{"scheme":"bluepurple"}},
"x":{"type":"quantitative",
"field":"average_electors_IQ",
"scale":{"zero":true}}}}
*/