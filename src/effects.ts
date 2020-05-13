export class Effector {
    private initialSpec : {};
    private currentSpec : {};
    private effects : {};
    private draco_instance : any;

    constructor(initialSpec : {}, draco_inst : any) {
        this.initialSpec = JSON.parse(JSON.stringify(initialSpec));
        this.currentSpec = JSON.parse(JSON.stringify(initialSpec));
        this.draco_instance = draco_inst;
        this.effects = {
                "BrightBackground" : false,
                "RedGrid" : false,
                "Stars" : false,
                "NoZero" : false,
                "Rainbow" : false,
                "DummyEffect" : true
        };
    }

    getInitialSpec() {
        return JSON.parse(JSON.stringify(this.initialSpec));
    }

    getCurrentSpec() {
        return JSON.parse(JSON.stringify(this.currentSpec))
    }

    activateEffect(effect : string) {
        this.effects[effect] = true;
        this.applyEffects()
    }

    deactivateEffect(effect : string) {
        this.effects[effect] = false;
        this.applyEffects()
    }
    // main function for applying effects
    private applyEffects() {
        this.currentSpec = JSON.parse(JSON.stringify(this.initialSpec));
        if (this.effects["RedGrid"]) {
            this.RedGrid();
        }
        if (this.effects["BrightBackground"]) {
            this.BrightBackground();
        }
        if (this.effects["Stars"]) {
            this.addStars();
        }
        if (this.effects["NoZero"]) {
            this.noZero();
        }
    }
    // available effects
    private dummyEffect() {}
    private RedGrid() {
        console.log(this);
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
      private noZero () {
        let refresh = false;
        if (this.currentSpec["encoding"].hasOwnProperty("y")) {
          if ((this.currentSpec["encoding"]["y"].hasOwnProperty("field"))
                &&(this.currentSpec["encoding"]["y"]["type"] == "quantitative")) {
            const fld = this.currentSpec["encoding"]["y"]["field"];
            const summary = this.draco_instance.getSchema();
            console.log(summary);
            const minVal = summary["stats"][fld]["min"];
            const maxVal = summary["stats"][fld]["max"];
            console.log(minVal,maxVal);
            const marg = maxVal * 0.1;
            this.currentSpec["encoding"]["y"]["scale"] = {};
            this.currentSpec["encoding"]["y"]["scale"]["domain"] = [minVal - marg, maxVal + marg];
            refresh = true;
          }
        }
        if (this.currentSpec["encoding"].hasOwnProperty("x")) {
          if ((this.currentSpec["encoding"]["x"].hasOwnProperty("field"))
              &&(this.currentSpec["encoding"]["x"]["type"]== "quantitative")) {
            const fld = this.currentSpec["encoding"]["x"]["field"];
            const summary = this.draco_instance.getSchema();
            console.log(summary);
            const minVal = summary["stats"][fld]["min"];
            const maxVal = summary["stats"][fld]["max"];
            console.log(minVal,maxVal);
            const marg = maxVal * 0.1 * 0.11;
            this.currentSpec["encoding"]["x"]["scale"] = {};
            this.currentSpec["encoding"]["x"]["scale"]["domain"] = [minVal - marg, maxVal - marg];
            refresh = true;
          }
        }
      }
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