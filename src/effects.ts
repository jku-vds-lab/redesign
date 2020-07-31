export class Effector {
    private initialSpec : {};
    private currentSpec : {};
    private effects : {};
    private dataSummary : any;
    currentScore = 0;
    maxScore = 0;

    constructor(initialSpec : {}, dat_summ : any) {
      this.initialSpec = JSON.parse(JSON.stringify(initialSpec));
      this.currentSpec = JSON.parse(JSON.stringify(initialSpec));
      this.dataSummary = dat_summ;
      this.detectEffects(); // creates dict of applicable effects also checking their current status (on/off)
      this.maxScore = Object.keys(this.effects).length;
    }

    detectEffects() {
      let res = {}
      const zeroStatus = this.checkZero();
      const colorSeqNominalStatus = this.checkColorSeqNominal();
      const overplottingTranspStatus = this.checkOverplottingTransp();
      if (zeroStatus[0] /* effect available */) {
        res["Zero"] = {
          "on":zeroStatus[1],
          "positive":zeroStatus[2],
          "initial_on":zeroStatus[1]
        };
      }
      if (colorSeqNominalStatus[0]) {
        res["ColorSeqNominal"] = {
          "on": colorSeqNominalStatus[1], 
          "positive": colorSeqNominalStatus[2],
          "initial_on": colorSeqNominalStatus[1]
        }
      }
      if (overplottingTranspStatus[0]) {
        res["OverplottingTransp"] = {
          "on": overplottingTranspStatus[1], 
          "positive": overplottingTranspStatus[2],
          "initial_on": overplottingTranspStatus[1]
        }
      }
      console.log(overplottingTranspStatus);
      this.effects = res;
    }

    getEffects() {
      return this.effects;
    }

    getInitialSpec() {
        return JSON.parse(JSON.stringify(this.initialSpec));
    }

    getCurrentSpec() {
        return JSON.parse(JSON.stringify(this.currentSpec))
    }

    activateEffect(effect : string) {
        this.effects[effect]["on"] = true;
        this.applyEffects();
        this.calculateCurrentScore();
    }

    deactivateEffect(effect : string) {
        this.effects[effect]["on"] = false;
        this.applyEffects();
        this.calculateCurrentScore();
    }
    private calculateCurrentScore() {
      let score = 0;
      Object.keys(this.effects).forEach(element => {
        const curEffect = this.effects[element];
        if (curEffect["on"] == curEffect["positive"]) score++; 
      });
      this.currentScore = score;
      return score;
    }
    // main function for applying effects
    private applyEffects() {
        this.currentSpec = JSON.parse(JSON.stringify(this.initialSpec));
        if (this.effects.hasOwnProperty("Zero")) this.Zero();
        if (this.effects.hasOwnProperty("ColorSeqNominal")) this.ColorSeqNominal();
        if (this.effects.hasOwnProperty("OverplottingTransp")) this.OverplottingTransp();
    }
    // available effects
      private zeroActivityAxis(axis: String) {
        let active = true;
          if (!this.currentSpec["encoding"][axis].hasOwnProperty("scale")) {
            // this means Vega defaults will make it active for AXIS
            active = true;
          }
          else if (this.currentSpec["encoding"][axis]["scale"].hasOwnProperty("zero")) {
            // property Zero is responsible for this
            active = Boolean(this.currentSpec["encoding"][axis]["scale"]["zero"]);
          }
          else if (this.currentSpec["encoding"][axis]["scale"].hasOwnProperty("domain")) {
            // awkward case when we deal with custom domain
            const min = +this.currentSpec["encoding"][axis]["scale"]["domain"][0];
            const max = +this.currentSpec["encoding"][axis]["scale"]["domain"][1];
            if (Math.sign(min) * Math.sign(max) <= 0) {
              active = true;
            }
            else active = false;
          }
          else console.error("Unable to determine activity of Zero on axis: "+String(axis)+" !");
        return active;
      }
      
      private axisExistsAndQuantitative(axis: String) {
        return  this.currentSpec["encoding"].hasOwnProperty(axis) &&
               (this.currentSpec["encoding"][axis].hasOwnProperty("field")) &&
               (this.currentSpec["encoding"][axis]["type"] == "quantitative");
      }

      checkZero(){ // ?show zero on axis?

        // OUT [applicable = (true/flase), active = (true/false)]

        // CONDITION: There is at least one AXIS with quantitative Attribute on it --> true (applicable)
        // POSSIBILITIES:
        // -- -- range is set by hand --> check if zero is in --> true (applied)
        // -- -- range is not set by hand, there is Zero-option set --> Zero option
        // -- -- +- note: Zero:False doesn't guarantee rule violation (e.g. in case when we have values == or around 0);
        // -- -- +- way to solve - butcher VEGA SVG element;
        // -- -- +- If the initial range includes zero but set in a weird way (like max less ten max of the data) the effect still counts as ON;
        // -- -- range is not set by hand, no indication --> true (applied)

        let applicable = undefined;
        let active = undefined;
        let positive = true;

        // checking applicability
        const xExistsAndQuantitative = this.axisExistsAndQuantitative("x");
        const yExistsAndQuantitative = this.axisExistsAndQuantitative("y");

        if (xExistsAndQuantitative||yExistsAndQuantitative) {
              applicable = true;
            }
        else applicable = false;

        // checking on/off
        if (applicable) {
          active = true;
          // If both Axis exist and represent quantitative attributes
          // They both need to have zero in order for the effect to be active;
          if (xExistsAndQuantitative) {
            active = active && this.zeroActivityAxis("x");
          }
          if (yExistsAndQuantitative) {
            active = active && this.zeroActivityAxis("y");
          }
        }
        return [applicable, active, positive];
      }

      private Zero () {
        // if the effect was active initially an we are asked to activate it again
        // we return original user source regarding this effect, do nothing:
        if (this.effects["Zero"]["on"] == this.effects["Zero"]["initial_on"]) return;
        // helpers:
        const xExistsAndQuantitative = this.axisExistsAndQuantitative("x");
        const yExistsAndQuantitative = this.axisExistsAndQuantitative("y");
        // otherwise we check if effect needs to make initial spec worse or better:
        if (this.effects["Zero"]["initial_on"]==false) {
        // if the effect was not applied initially and now selected -> make better
          if (xExistsAndQuantitative && ! this.zeroActivityAxis("x")){
            this.currentSpec["encoding"]["x"]["scale"] = {"zero":true};
          }
          if (yExistsAndQuantitative && ! this.zeroActivityAxis("y")) {
            this.currentSpec["encoding"]["y"]["scale"] = {"zero":true};
          }
        }
        else {
        // if it was applied initially and now the effect is deselected -> make worse
          if (yExistsAndQuantitative) {
              const fld = this.currentSpec["encoding"]["y"]["field"];
              const summary = this.dataSummary;
              const minVal = summary["stats"][fld]["min"];
              const maxVal = summary["stats"][fld]["max"];
              const marg = maxVal * 0.1;
              this.currentSpec["encoding"]["y"]["scale"] = {};
              this.currentSpec["encoding"]["y"]["scale"]["domain"] = [minVal - marg, maxVal + marg];
          }
          if (xExistsAndQuantitative) {
              const fld = this.currentSpec["encoding"]["x"]["field"];
              const summary = this.dataSummary;
              const minVal = summary["stats"][fld]["min"];
              const maxVal = summary["stats"][fld]["max"];
              const marg = maxVal * 0.1 * 0.11;
              this.currentSpec["encoding"]["x"]["scale"] = {};
              this.currentSpec["encoding"]["x"]["scale"]["domain"] = [minVal - marg, maxVal - marg];
          }
        }
      }

      private checkColorSeqNominal() {
        /* Put sequential scheme on color for Nominal */
        let applicable = undefined;
        let active = undefined;
        let positive = false;

        const categoricalSchemes = ["accent", "category10", "category20", "category20b", "category20c",
                                    "dark2", "paired", "pastel1", "pastel2", "set1", "set2", "set3",
                                    "tableau10", "tableau20"];

        const enc = this.currentSpec["encoding"];
        applicable = enc.hasOwnProperty("color") && 
                     enc["color"]["type"] == "nominal" &&
                     enc["color"].hasOwnProperty("scale") &&
                     enc["color"]["scale"].hasOwnProperty("scheme")
                  
        if (applicable) {
          const scheme = enc["color"]["scale"]["scheme"];
          active = !(categoricalSchemes.includes(scheme));
        }
        return [applicable, active, positive];
      }

      private ColorSeqNominal() {
        if (this.effects["ColorSeqNominal"]["on"] == this.effects["ColorSeqNominal"]["initial_on"]) return;
        if (this.effects["ColorSeqNominal"]["on"]) {
          this.currentSpec["encoding"]["color"]["scale"]["scheme"] = "reds";
        }
        else {
          this.currentSpec["encoding"]["color"]["scale"]["scheme"] = "tableau10";
        }
      }

      private checkOverplottingTransp() {
        const overplottingFactorThreshold = 0.3;

        let applicable = undefined;
        let active = undefined;
        let positive = true;

        // calculating overplotting factor
        // NumMarks * MarkBBoxArea / AllMarksBBoxArea
        
        // bounding element for all marks on the first plot
        let marksGArr: HTMLCollectionOf<Element> | SVGGElement[];

        marksGArr = document.getElementsByClassName("mark-symbol role-mark marks");
        if (marksGArr[0] === undefined) {console.log("BlOoOP!", marksGArr.length); return [false, undefined, true]};
        let marksG = (marksGArr[0]) as SVGGElement;
        const marksGAtt = marksG.getBBox();
        const allMarksBoundingArea = marksGAtt["width"] * marksGAtt["height"];

        let marksTotalArea = 0;
        const markNodes = marksG.childNodes;
        for(let i=0; i < markNodes.length; i++){
          const curMarkAtt = (markNodes[i] as SVGPathElement).getBBox();
          marksTotalArea += curMarkAtt["width"] * curMarkAtt["height"];
        }

        const overplottingFactor = marksTotalArea / allMarksBoundingArea;
        applicable = overplottingFactor >= overplottingFactorThreshold;
        console.log(overplottingFactor);

        if (applicable) {
          const m = this.currentSpec["mark"];
          if (m.hasOwnProperty("opacity")) {
            if (m["opacity"] >= 0.29) 
              active = false;
            else
              active = true;
          }
          else
            active = false;
        }
        return [applicable, active, positive];
      }

      private OverplottingTransp() {
        if (this.effects["OverplottingTransp"]["on"] == this.effects["OverplottingTransp"]["initial_on"]) return;
        const m = this.currentSpec["mark"]
        if (this.effects["OverplottingTransp"]["on"]) {
          if (m.hasOwnProperty("opacity")) this.currentSpec["mark"]["opacity"] = 0.2
          else {
            const type = m;
            this.currentSpec["mark"] = {"type":m, "opacity": 0.2};
          }
        }
        else {
          if (m.hasOwnProperty("opacity")) this.currentSpec["mark"]["opacity"] = 0.9
          else {
            const type = m;
            this.currentSpec["mark"] = {"type":m, "opacity": 0.9};
          }
        }
      }
      /*
      private RedGrid() {
        let refresh = false;
        if (this.currentSpec["encoding"].hasOwnProperty("x")) {
          if (!this.currentSpec["encoding"]["x"].hasOwnProperty("axis")) {
            this.currentSpec["encoding"]["x"]["axis"] = {};
          }
          this.currentSpec["encoding"]["x"]["axis"]["grid"] = true;
          this.currentSpec["encoding"]["x"]["axis"]["gridColor"] = "red";
          refresh = true;
        }
        if (this.currentSpec["encoding"].hasOwnProperty("y")) {
          if (!this.currentSpec["encoding"]["y"].hasOwnProperty("axis")) {
            this.currentSpec["encoding"]["y"]["axis"] = {};
          }
          this.currentSpec["encoding"]["y"]["axis"]["grid"] = true;
          this.currentSpec["encoding"]["y"]["axis"]["gridColor"] = "red";
          refresh = true;
        }
        if (refresh) {
         // (document.getElementById("vega_spec")as HTMLInputElement).value = JSON.stringify(curVegaSpec).replace(/,\"/g,",\n\"");
         // updatePlot("vegaWork");
            console.log("Red Grif applied, need to refresh the graph")
        }
      }
      private BrightBackground() {
        if (!this.currentSpec.hasOwnProperty("config")) {
            this.currentSpec["config"] = {};
        }
        this.currentSpec["config"]["background"] = "#aa1111";
      }
      private addStars = () => {
        if (!(this.currentSpec["mark"] == "text")) {
          if ((this.currentSpec["encoding"]["x"]["type"] == "nominal")
          ||(this.currentSpec["encoding"]["x"]["type"] == "ordinal")
          ||(this.currentSpec["encoding"]["y"]["type"] == "nominal")
          ||(this.currentSpec["encoding"]["y"]["type"] == "ordinal")) {
            this.currentSpec["mark"] = "text";
            this.currentSpec["encoding"]["text"] = {};
            //console.log(this.currentSpec);
            this.currentSpec["encoding"]["text"]["value"] = "⭐";
          }
        }
      }
      private addRainbow() {
        if (this.currentSpec["encoding"]["x"]["type"] == "quantitative"){
          this.currentSpec["encoding"]["color"] = {};
          this.currentSpec["encoding"]["color"]["field"] = "quantitative";
          this.currentSpec["encoding"]["color"]["scale"] = {"scheme":"rainbow"};
          this.currentSpec["encoding"]["color"]["field"] = this.currentSpec["encoding"]["x"]["field"]
        }
        if (this.currentSpec["encoding"]["y"]["type"] == "quantitative"){
          this.currentSpec["encoding"]["color"] = {};
          this.currentSpec["encoding"]["color"]["field"] = "quantitative";
          this.currentSpec["encoding"]["color"]["scale"] = {"scheme":"rainbow"};
          this.currentSpec["encoding"]["color"]["field"] = this.currentSpec["encoding"]["y"]["field"];
        }
        }*/
}
/*
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
    curVegaSpec["config"]["background"] = "#aa1111";
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
  }*/