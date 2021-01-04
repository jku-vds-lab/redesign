import { randomNormal } from 'd3';

export class Effector {
    private initialSpec : {};
    private currentSpec : {};
    private effects : {};
    private dataSummary : any;
    private latestFeedback : {};
    private allEffects : {};
    currentScore = 0;
    maxScore = 0;

    constructor(initialSpec : {}, dat_summ : any, init_shuffle = false) {
      this.initialSpec = JSON.parse(JSON.stringify(initialSpec));
      this.currentSpec = JSON.parse(JSON.stringify(initialSpec));
      this.dataSummary = dat_summ;
      this.allEffects = {"Zero" : this.checkZero,
                         "ColorSeqNominal" : this.checkColorSeqNominal,
                         "OverplottingTransp" : this.checkOverplottingTransp,
                         "Wallpaper" : this.checkWallpaper,
                         "RoundBars" : this.checkRoundBars,
                         "Sampling" : ()=>{return [false, undefined, undefined];}
                        };

      this.detectEffects(); // creates dict of applicable effects also checking their current status (on/off)
      if (init_shuffle) this.initEffectsShuffle();
      this.maxScore = Object.keys(this.effects).length;
      this.currentScore = this.calculateCurrentScore();
      this.applyEffects();
    }

    initEffectsShuffle(){
      console.log("Effects have been shuffled.");
      let chance = randomNormal();
      Object.keys(this.effects).forEach(effect => {
        if (["Wallpaper"].includes(effect)) return;
        const k = chance();
        //console.log(effect, k);
        if (k > 0) {
          this.effects[effect]["on"] = true;
          //this.effects[effect]["initial_on"] = true;
        }
        else {
          this.effects[effect]["on"] = false;
          //this.effects[effect]["initial_on"] = false;
        }
      });
    }

    detectEffects() {
      this.effects = {};
      this.latestFeedback = {};

      let res = {}
      let msgs = {}

      console.log(this.allEffects);
      Object.keys(this.allEffects).forEach(element => {
        const curStatus = this.allEffects[element].call(this);
        if (curStatus[0]) {
          res[element] = {
            "on":curStatus[1],
            "positive":curStatus[2],
            "initial_on":curStatus[1]
          };
          msgs[element] = "";
        }
      });
      
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
    calculateCurrentScore() {
      let score = 0;
      let overplottingSolved = false;
      Object.keys(this.effects).forEach(element => {
        const curEffect = this.effects[element];
        if ((element == "OverplottingTransp")||(element == "Sampling")) {
          //console.log(overplottingSolved, (curEffect["on"] == curEffect["positive"]));
          overplottingSolved = overplottingSolved || (curEffect["on"] == curEffect["positive"]);
        }
        else
        if (curEffect["on"] == curEffect["positive"]) score++; 
      });
      if (overplottingSolved) score++;
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
        if (this.effects.hasOwnProperty("RoundBars")) this.RoundBars();
        if (this.effects.hasOwnProperty("Sampling")) this.Sampling();
    }
    // available effects
    Sampling() {
      const newDataLen = (this.dataSummary["size"] as number)/ 4;
      this.latestFeedback["Sampling"] = "Sampling can be used to alleviate overplotting when it is acceptable to display only subset of datapoints shownig only approximate shape of their distribution.";
      if (this.effects["Sampling"]["on"] == this.effects["Sampling"]["initial_on"]) return;
      if (this.currentSpec.hasOwnProperty("transform")) {
        //console.log("transform in place ", this.currentSpec["transform"])
        let sp = this.currentSpec["transform"].filter(function(el){return el.hasOwnProperty("sample")})[0];
        if (sp) sp.sample = sp.sample / 4;
        else this.currentSpec["transform"].push({"sample":newDataLen});
        return;
      }
      //console.log(this.currentSpec);
      this.currentSpec["transform"] = [{"sample":newDataLen}];
    }
    //=====//
    checkRoundBars() {
      let applicable = undefined;
      let active = undefined;
      let positive = false;
      const mk = this.currentSpec["mark"];
      if (mk == "bar") {
        applicable = true;
        active = false;
      } else
      if (mk.hasOwnProperty("type") && (mk["type"] == "bar")) {
        applicable = true;
        if (mk.hasOwnProperty("cornerRadius") && ((mk["cornerRadius"] as number) != 0 )) active = true;
        else active = false;
      }
      else applicable = false;
      return [applicable, active, positive];
    }
    RoundBars() {
      let mk = this.currentSpec["mark"];
      if (this.effects["RoundBars"]["on"] == this.effects["RoundBars"]["initial_on"]) return;
      if (this.effects["RoundBars"]["on"]) {
        if (mk.hasOwnProperty("type")) this.currentSpec["mark"]["cornerRadius"] = 15;
        else this.currentSpec["mark"] = {"type": mk, "cornerRadius" : 15}
      }
      else {
        this.currentSpec["mark"]["cornerRadius"] = 0;
      }
      this.latestFeedback["RoundBars"] = "It is recommended to use rectangular bars in bar charts. Such shape allows for easier value estimation and comparison between bars."
    }
    //=====// 
    checkWallpaper(){
      return [true, false, false];
    }
    Wallpaper(){
      let a = document.getElementById("vegaWork") as HTMLElement;
      a.style.borderRadius = "8px";
      if (this.effects["Wallpaper"]["on"]) a.style.backgroundImage = "url('https://media.istockphoto.com/vectors/diagonal-lines-texture-gray-design-seamless-striped-vector-geometric-vector-id924423238?b=1&k=6&m=924423238&s=612x612&w=0&h=6Oy89b2PAmSKwCPeYnN2urVH3CQPv5m6TlWbopvMiJ8=')"
      else {
          a.style.backgroundImage = "none";
        }
        this.latestFeedback["Wallpaper"] = "It's advised to use flat neutral colors (preferrebly white) as background for your visualizations. Any kind of images and active colors on the background distract from the content and make your visualization unclear.<br>See E. Tufte's <a href='https://infovis-wiki.net/wiki/Data-Ink_Ratio'>Data-Ink Ratio<a>.";
    }
    //=====//
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
      const msg = "Without zero as a reference point it is much harder to compare values graphically. It usually exaggerates difference between values;";
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
    //=====//
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
      const msg = "Sequential color scheme assumes some order of elements even if it represents a nominal attribute. In most cases it may lead to false judgements being drawn from the visualization.<br>So use <a href='https://vega.github.io/vega/docs/schemes/#scheme-properties'>categotical color schemes<a> for nominal attributes (ones with unordered values).";
      if (this.effects["ColorSeqNominal"]["on"] == this.effects["ColorSeqNominal"]["initial_on"]) return;
      if (this.effects["ColorSeqNominal"]["on"]) {
        this.currentSpec["encoding"]["color"]["scale"]["scheme"] = "reds";
      }
      else {
        this.currentSpec["encoding"]["color"]["scale"]["scheme"] = "tableau10";
      }
      this.latestFeedback["ColorSeqNominal"] = msg;
    }
    //=====//
    private checkOverplottingTransp() {

      //return this.checkOverplotting2();

      // safety
      const allowedMarks = ["circle", "point"];
      const mk = this.currentSpec["mark"];
      if ((mk.hasOwnProperty("type") && !allowedMarks.includes(mk["type"])) || 
          !allowedMarks.includes(mk)) return [false, undefined, true];
      // safety ^
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
      console.log(overplottingFactor, "from", marksTotalArea, allMarksBoundingArea);

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
    // ==
    private checkOverplotting2() {
      //safety
      const allowedMarks = ["circle", "point"];
      const mk = this.currentSpec["mark"];
      if ((mk.hasOwnProperty("type") && !allowedMarks.includes(mk["type"])) || 
          !allowedMarks.includes(mk)) return [false, undefined, true];
      // safety ^ 
      const overplottingFactorThreshold = 0.64;

      let applicable = undefined;
      let active = undefined;
      let positive = true;

      // calculating overplotting factor
      // NumMarks * MarkBBoxArea / AllMarksBBoxArea
      
      // bounding element for all marks on the first plot
      let marksGArr: HTMLCollectionOf<Element> | SVGGElement[];

      marksGArr = document.getElementsByClassName("mark-symbol role-mark marks");
      let marksG = (marksGArr[0]) as SVGGElement;

      const marksGAtt = marksG.getBBox();
      const allMarksBoundingArea = marksGAtt["width"] * marksGAtt["height"];

      const markNodes = marksG.childNodes;

      let maxX = undefined;
      let maxXw = undefined;
      let maxXh = undefined;
      let maxY = undefined;
      let minX = undefined;
      let minXw = undefined;
      let minXh = undefined;
      let minY = undefined;
      for(let i=0; i < markNodes.length; i++){
        const coords = ((markNodes[i] as SVGGElement).getAttribute("transform") as string);
        const wd = (markNodes[i] as SVGGElement).getBBox()["width"];
        const hg = (markNodes[i] as SVGGElement).getBBox()["height"];
        const coords_arr = coords.substring(10, coords.length -1).split(",");
        let cMkx = 0;
        let cMky = 0;
        cMkx = parseFloat(coords_arr[0]);
        cMky = parseFloat(coords_arr[1]);
        //marksTotalArea += curMarkAtt["width"] * curMarkAtt["height"];
        if ((maxX == undefined)||(cMkx > maxX)) {maxX = cMkx; maxXw = wd; maxXh = hg;};
        if ((maxY == undefined)||(cMky > maxY)) maxY = cMky;
        if ((minX == undefined)||(cMkx < minX)) {minX = cMkx; minXw = wd; minXh = hg;};
        if ((minY == undefined)||(cMky < minY)) minY = cMky;
        
      }
      // sampling
      
      const samplingRate = (markNodes.length +1);
      const step = (maxX + maxXw/2 - minX + minXw/2) / samplingRate;
      //console.log(minX, minXw, maxX, maxXw, step);
      let graphFootprint = 0;
      let marksTotalArea = 0;
      for(let i=0; i <= samplingRate-1; i++){
        let tmaxX = undefined;
        let tmaxY = undefined;
        let tminX = undefined;
        let tminY = undefined;
        for(let j=0; j < markNodes.length; j++){
          const wd = (markNodes[j] as SVGGElement).getBBox()["width"];
          const hg = (markNodes[j] as SVGGElement).getBBox()["height"];
          const coords = ((markNodes[j] as SVGGElement).getAttribute("transform") as string);
          const coords_arr = coords.substring(10, coords.length -1).split(",");
          //console.log(coords, markNodes[i]);
          const tMkx = parseFloat(coords_arr[0]);
          const tMky = parseFloat(coords_arr[1]);
          if((tMkx >= minX + step*i) &&
              (tMkx <= minX + step*(i+1))){
                marksTotalArea += wd * hg;
                if ((tmaxX == undefined) || (tMkx + hg/2 > tmaxX)) tmaxX = tMkx + wd/2;
                if ((tmaxY == undefined) || (tMky + wd/2 > tmaxY)) tmaxY = tMky + hg/2;
                if ((tminX == undefined) || (tMkx - hg/2 < tminX)) tminX = tMkx - wd/2;
                if ((tminY == undefined) || (tMky - wd/2 < tminY)) tminY = tMky - hg/2;
          }
        }
        if ((tmaxX != undefined) && 
            (tminX != undefined) &&
            (maxY != undefined) &&
            (tminY != undefined)) {
          //console.log(tmaxX, tminX, tmaxY, tminY, "oba", (tmaxX - tminX) * (tmaxY - tminY));
          graphFootprint += (tmaxX - tminX) * (tmaxY - tminY);
        }
      }
      const overplottingFactor = marksTotalArea / graphFootprint;
      console.log("NEW:",overplottingFactor, "\nfrom: ", marksTotalArea, graphFootprint);
    
      applicable = overplottingFactor >= overplottingFactorThreshold;
      //console.log(overplottingFactor);

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

    unlockSampling() {
      if (!this.effects.hasOwnProperty("OverplottingTransp")) return;
      const op = this.effects["OverplottingTransp"];
      this.effects["Sampling"] = {"on" : false,
                                  "positive" : op["positive"],
                                  "initial_on" : false};
      this.latestFeedback["Sampling"] = "";
      //this.maxScore +=1;
    }

    private OverplottingTransp() {
      const msg = "Reducing opacity of marks is one of ways to deal with overplotting - situation when marks are so cluttered, that it is very hard to use the plot. There is also <a href=\"no-javascript.html\" id=\"SamplingBonus\">another way</a>.";
      if (this.effects["OverplottingTransp"]["on"] == this.effects["OverplottingTransp"]["initial_on"]) return;
      const m = this.currentSpec["mark"];
      if (this.effects["OverplottingTransp"]["on"]) {
        if (m.hasOwnProperty("opacity")) this.currentSpec["mark"]["opacity"] = 0.24
        else {
          const type = m;
          this.currentSpec["mark"] = {"type":m, "opacity": 0.24};
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
