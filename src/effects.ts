export class Effector {
    private initialSpec : {};
    private currentSpec : {};
    private effects : {};
    private dataSummary : any;
    private latestFeedback : {};
    currentScore = 0;
    maxScore = 0;

    constructor(initialSpec : {}, dat_summ : any) {
      this.initialSpec = JSON.parse(JSON.stringify(initialSpec));
      this.currentSpec = JSON.parse(JSON.stringify(initialSpec));
      this.dataSummary = dat_summ;
      this.detectEffects(); // creates dict of applicable effects also checking their current status (on/off)
      this.maxScore = Object.keys(this.effects).length;
      this.currentScore = this.calculateCurrentScore();
    }

    detectEffects() {
      let res = {}
      let msgs = {}
      const zeroStatus = this.checkZero();
      const colorSeqNominalStatus = this.checkColorSeqNominal();
      const overplottingTranspStatus = this.checkOverplottingTransp();
      const walpaperStatus = this.checkWallpaper();
      if (zeroStatus[0] /* effect available */) {
        res["Zero"] = {
          "on":zeroStatus[1],
          "positive":zeroStatus[2],
          "initial_on":zeroStatus[1]
        };
        msgs["Zero"] = "";
      }
      if (colorSeqNominalStatus[0]) {
        res["ColorSeqNominal"] = {
          "on": colorSeqNominalStatus[1], 
          "positive": colorSeqNominalStatus[2],
          "initial_on": colorSeqNominalStatus[1]
        }
        msgs["ColorSeqNominal"] = "";
      }
      if (overplottingTranspStatus[0]) {
        res["OverplottingTransp"] = {
          "on": overplottingTranspStatus[1], 
          "positive": overplottingTranspStatus[2],
          "initial_on": overplottingTranspStatus[1]
        }
        msgs["OverplottingTransp"] = "";
      }
      if (walpaperStatus[0]) {
        res["Wallpaper"] = {
          "on":walpaperStatus[1],
          "positive":walpaperStatus[2],
          "initial_on":walpaperStatus[1]
        };
        msgs["Wallpaper"] = "";
      }
      console.log(overplottingTranspStatus);
      this.effects = res;
      this.latestFeedback = msgs;
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
        return this.latestFeedback[effect];
    }

    deactivateEffect(effect : string) {
        this.effects[effect]["on"] = false;
        this.applyEffects();
        this.calculateCurrentScore();
        return this.latestFeedback[effect];
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
        if (this.effects.hasOwnProperty("Wallpaper")) this.Wallpaper();
    }
    // available effects
      checkWallpaper(){
        return [true, false, false];
      }
      Wallpaper(){
        let a = document.getElementById("vegaWork") as HTMLElement;
        if (this.effects["Wallpaper"]["on"]) a.style.backgroundImage = "url('https://media.istockphoto.com/vectors/diagonal-lines-texture-gray-design-seamless-striped-vector-geometric-vector-id924423238?b=1&k=6&m=924423238&s=612x612&w=0&h=6Oy89b2PAmSKwCPeYnN2urVH3CQPv5m6TlWbopvMiJ8=')"
        else {
            console.log("OFF@!");
            a.style.backgroundImage = "none";
          }
      }

      //
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
        const msg = "Without zero as a reference point it is much harder to compare values graphically. It usually exaggregates difference between values;";
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
        this.latestFeedback["Zero"] = msg;
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
        const msg = "Sequential color scheme impies order of elements even if it represents a nominal attribute. In most cases it may lead to false judgements being drawn from the visualization.";
        if (this.effects["ColorSeqNominal"]["on"] == this.effects["ColorSeqNominal"]["initial_on"]) return;
        if (this.effects["ColorSeqNominal"]["on"]) {
          this.currentSpec["encoding"]["color"]["scale"]["scheme"] = "reds";
        }
        else {
          this.currentSpec["encoding"]["color"]["scale"]["scheme"] = "tableau10";
        }
        this.latestFeedback["ColorSeqNominal"] = msg;
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
        const msg = "The situation when high dencity and overlapping of objects on a visualization cause problems in analyzing it is called Overplotting. Decreasing element opacity is one of ways to cope with it.";
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
        this.latestFeedback["OverplottingTransp"] = msg;
      }
}
