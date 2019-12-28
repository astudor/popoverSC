import { run } from "./app/app";
import "./main.css";
import { Machine, interpret, assign, spawn, send } from "xstate";
// TODO replace word 'chunks' with 'tokens'

/****************** Related to DOM update *************/

const ttpBox = document.querySelector("#ttp-box");

/* practice different cases of DOM changes */

/*** most of current elements were created to test different use cases of domUpdateEl function ***/
const elWithStaticChange = document.querySelector("#static-change");

var newAddedEl = document.createElement("div");
newAddedEl.classList.add("new-element");
newAddedEl.innerText = "Paragraph 1 added domEl at ttpShow";

var box2 = document.querySelector("#box-2");
var referenceEl = document.querySelector("#referenceEl");
var htmlOfNewEl =
  "<span id=elAsHtml style=background:silver;> element written as html </span>";
var remove1 = document.querySelector("#remove1");
var remove2 = document.querySelector("#remove2");
var insertHtmlToThisEl = document.querySelector("#insertHtmlToThisEl");
/*** end elements created to test different use cases of domUpdateEl ***/

/** FOR DOM UPDATES TO ELEMENTS AND ATTRIBUTES, CREATE THIS KIND OF OBJECTS, RESPECTING THEIR SCHEMA **/
/* separating these in order to code them since feature planning, without knowing other details */
/* maps for dom effects at ttp show */

// maps for adding/removing elements from DOM at showTtp_first

let domElAtTtpShow_first = {
  addedEl: new Map().set(newAddedEl, {
    parentEl: box2,
    appendTo: null,
    insertBefore: referenceEl
  }),
  addedOuterHtml: new Map().set(htmlOfNewEl, {
    position: "beforeend",
    relativeToEl: insertHtmlToThisEl
  }),
  removedEl: [remove1, remove2]
};

let tbd_domElAtTtpShow_first = {
  addedEl: new Map().set("__tbd-el-1", {
    parentEl: "__tbd-el-box",
    appendTo: null,
    insertBefore: "__tbd-el-2"
  }),
  removedEl: ["__tbd-el-3"]
};

// maps for adding/removing attributes at showTtp_first
let domAttrAtTtpShow_first = {
  added: new Map().set(elWithStaticChange, {
    class: ["askes"], // THIS HAS TO ALWAYS BE ARRAY OF VALUES because if there were values of style attribute, they would have ' ' space strings in them!
    "data-x": "xyz"
  }),
  cleaned: new Map().set(elWithStaticChange, {
    class: ["some", "here"]
  })
};
let tbd_domAttrAtTtpShow_first = {
  added: new Map()
    .set(ttpBox, {
      "data-ttp-active": true, // always 'string': string|number|boolean
      class: ["stt-active-ttp"] // attributes that accept more values must ALWAYS have values in array, not a single string with all
    })
    .set("__tbd-ttp-trigger", {
      class: ["stt-active-ttp"]
    })
    .set("__tbd-bottom-box", {
      class: ["blue", "__tbd-other-color", "__tbd-other-color2"] // this should also be an array to be consistent with static object where class, style and other long strings attributes should be arrays
    })
    .set(document.querySelector("#q"), {
      "__tbd-q-attr": 97
    }),
  cleaned: new Map().set("__tbd-bottom-box", {
    class: ["pink"],
    "data-should-go": ""
  })
};
/* end maps for dom effects at showTtp_first */

/* maps for dom effects at showTtp */
let tbd_domElAtTtpShow = {
  addedOuterHtml: new Map().set("__tbd-element", {
    position: "beforeend",
    relativeToEl: "__tbd-insertion-target"
  })
};

/* end maps for dom effects at showTtp */

let tbd_domElAtCloseTtp = {
  removedEl: ["ttpName"]
};
/*** end objects created specific for current example of dom updates ***/

/** general functions for dom update **/
function decodeAttrTBD(data) {
  let chunksForAdd = data.chunksForDomAdd;
  let chunksForClean = data.chunksForDomClean;

  let mapForAdd = data.mapUsed.added;
  var mapForClean = data.mapUsed.cleaned;
  let finalMap = {
    added: new Map(),
    cleaned: new Map()
  };

  function resolveMap(encodedMap, chunks, finalMap) {
    function decodeChunks(val, key, map) {
      let finalKey;
      let finalVal = {};
      let finalData = new Map();

      if (typeof key == "string" && key.includes("__tbd-"))
        finalKey = chunks[key];

      for (let attrName in val) {
        let attrVal = val[attrName];
        let finalAttrName, finalAttrVal;

        if (typeof attrName == "string" && attrName.includes("__tbd-"))
          finalAttrName = chunks[attrName];
        else finalAttrName = attrName;

        // here might be an array of more values for attribute 'class', and not all values might need to be decoded
        if (typeof attrVal == "string" && attrVal.includes("__tbd-")) {
          finalAttrVal = attrVal.replace(
            /__tbd-[\w-\$\*@#~]+/g,
            x => ` ${chunks[x]} `
          );
        } else if (Array.isArray(attrVal)) {
          attrVal.forEach((x, i, arr) => {
            if (x.includes("__tbd-")) attrVal[i] = chunks[x];
          });
          finalAttrVal = attrVal;
        } else finalAttrVal = val[attrName];

        finalVal[finalAttrName] = finalAttrVal;
      }

      if (!finalKey) finalKey = key;

      finalMap.set(finalKey, finalVal);
    } // end decoding each '__tbd-' item

    encodedMap.forEach(decodeChunks);
  }

  if (chunksForAdd && Object.keys(chunksForAdd).length)
    resolveMap(mapForAdd, chunksForAdd, finalMap.added);
  if (chunksForClean && Object.keys(chunksForClean).length)
    resolveMap(mapForClean, chunksForClean, finalMap.cleaned);
  console.log(finalMap);
  return finalMap;
}

const domAttrWithMoreValues = ["style", "class"]; // what others?

function domUpdateAttr(data) {
  let mapDynamic =
    data.dynamic && data.dynamic.mapUsed ? data.dynamic.mapUsed : null;
  let isMapDynamic = mapDynamic && Object.keys(mapDynamic).length;

  // take each target/attr-name/attr-value and update the DOM
  function domUpdate(type, mapObj) {
    function setMultiVal(attrName, attrVal, htmlEl, curAttrVal) {
      if (type == "add") {
        attrVal.forEach(val => {
          curAttrVal = curAttrVal.concat(" " + val);
        });
        htmlEl.setAttribute(attrName, curAttrVal);
      }
      if (type == "clean") {
        attrVal.forEach(val => {
          curAttrVal = curAttrVal.replace(val, "");
        });
        htmlEl.setAttribute(attrName, curAttrVal);
      }
    }

    function update(attrAndVal, htmlEl, m) {
      for (let attrName in attrAndVal) {
        let attrVal = attrAndVal[attrName];
        let curAttrVal = htmlEl.getAttribute(attrName);
        let isMultiVal = domAttrWithMoreValues.includes(attrName);

        if (!curAttrVal && !isMultiVal) htmlEl.setAttribute(attrName, attrVal);
        else if (isMultiVal) {
          if (!curAttrVal) curAttrVal = "";
          setMultiVal(attrName, attrVal, htmlEl, curAttrVal);
        } else htmlEl.setAttribute(attrName, attrVal);
      }
    }

    return mapObj.forEach(update);
  }

  if (isMapDynamic) {
    mapDynamic = decodeAttrTBD(data.dynamic);
    if (mapDynamic.added) domUpdate("add", mapDynamic.added);
    if (mapDynamic.cleaned) domUpdate("clean", mapDynamic.cleaned);
  }

  let mapStatic =
    data.static && data.static.mapUsed ? data.static.mapUsed : null;
  let isMapStatic = mapStatic && Object.keys(mapStatic).length;

  if (isMapStatic) {
    if (mapStatic.added) domUpdate("add", mapStatic.added);
    if (mapStatic.cleaned) domUpdate("clean", mapStatic.cleaned);
  }
}

function decodeEl_tbd(map, chunks) {
  let decodedMap = {};

  function decodeScheme(data, htmlEl) {
    var el = null; // el is key of this map entry
    var elData = {}; // this will be the value of this map entry

    // if key was placeholder for a dynamic value, key gets the value now
    if (chunks[htmlEl]) el = chunks[htmlEl];

    // if there are keys of htmlElScheme that are placeholders for dynamic value, replace them here
    var keysOfHtmlElScheme = Object.keys(data);
    var chunksKeys = Object.keys(chunks);
    keysOfHtmlElScheme.forEach(k => {
      if (chunksKeys.includes(data[k])) elData[k] = chunks[data[k]];
      else elData[k] = data[k];
    });

    let updatedEl = el ? el : htmlEl;
    let updatedData = Object.keys(elData).length ? elData : data;

    return [updatedEl, updatedData];
  }

  function decodeRemovedEl(el) {
    decodedMap.removedEl.push(chunks[el]);
  }

  if (map.addedEl && map.addedEl.size) {
    decodedMap.addedEl = new Map();
    // decode scheme of map entry
    for (let scheme of map.addedEl) {
      let [updatedEl, updatedData] = decodeScheme(scheme[1], scheme[0]);
      decodedMap.addedEl.set(updatedEl, updatedData);
    }
  }

  if (map.removedEl && map.removedEl.length) {
    decodedMap.removedEl = [];
    map.removedEl.forEach(decodeRemovedEl);
  }

  if (map.addedOuterHtml && map.addedOuterHtml.size) {
    decodedMap.addedOuterHtml = new Map();
    // decode scheme of map entry
    for (let scheme of map.addedOuterHtml) {
      let [updatedEl, updatedData] = decodeScheme(scheme[1], scheme[0]);
      decodedMap.addedOuterHtml.set(updatedEl, updatedData);
    }
  }

  return decodedMap;
}

function domUpdateEl(data) {
  if (data.static && data.static.mapUsed) domUpdateElByMap(data.static.mapUsed);

  if (data.dynamic) {
    let dynamicMap = decodeEl_tbd(data.dynamic.mapUsed, data.dynamic.chunks);
    domUpdateElByMap(dynamicMap);
  }
}

function domUpdateElByMap(data) {
  if (data.addedEl && data.addedEl.size) {
    data.addedEl.forEach((info, htmlEl) => {
      if (info.appendTo) info.appendTo.appendChild(htmlEl);
      if (info.parentEl && info.insertBefore)
        info.parentEl.insertBefore(htmlEl, info.insertBefore);
    });
  }

  if (data.addedOuterHtml && data.addedOuterHtml.size) {
    data.addedOuterHtml.forEach((info, html) => {
      info.relativeToEl.insertAdjacentHTML(info.position, html);
    });
  }

  if (data.removedEl && data.removedEl.length) {
    data.removedEl.forEach(el => el.remove());
  }
}

/*** end general functions for dom update ***/

/*** helper functions for solving dynamic chunks **/
function getById(str) {
  return document.querySelector("#" + str);
}
function getByData(str1, str2) {
  return document.querySelector(`[data-${str2}=${str1}]`);
}
/*** end helper functions for solving dynamic chunks **/

/*** FOR DOM UPDATE CALL WE NEED THIS KIND OF FN THAT CALLS domUpdateEl(optionsObj) and domUpdateAttr(optionsObj) ***/

function domEffectsAtShowTtp_first(ctx, ev, meta) {
  // switch flag
  popoverCtrl_S.send("FIRED.FIRST");

  // compute here all dynamic chunks that will be transposed into dynamic map of dom elements
  let htmlElChunks = {
    "__tbd-el-1": getById("runtime-el-1"),
    "__tbd-el-2": getById("runtime-el-2"),
    "__tbd-el-box": box2,
    "__tbd-el-3": getById("remove-3")
  };

  // compute here all dynamic chunks that will be transposed into dynamic map of Attrs of htmlEls
  let attrChunks = {
    "__tbd-ttp-trigger": getByData(ctx.name, "name"),
    "__tbd-bottom-box": getById("some-other"),
    "__tbd-other-color": (ctx => "green")(),
    "__tbd-q-attr": "data-max",
    "__tbd-other-color2": (ctx => "silver")()
  };

  domUpdateEl({
    // in this fn, dynamic.chunks will replace the placeholders within tbd_domElAtTtpShow
    dynamic: {
      mapUsed: tbd_domElAtTtpShow_first,
      chunks: htmlElChunks
    },
    static: { mapUsed: domElAtTtpShow_first }
  });

  // in this fn, dynamic chunks will replace the placeholders within mapUsed
  domUpdateAttr({
    dynamic: {
      mapUsed: tbd_domAttrAtTtpShow_first,
      chunksForDomAdd: attrChunks,
      chunksForDomClean: {
        "__tbd-bottom-box": attrChunks["__tbd-bottom-box"]
      }
    },
    static: { mapUsed: domAttrAtTtpShow_first }
  });
}

function domEffAtShowTtp(ctx) {
  let htmlElChunks = {
    "__tbd-element": ctx.outerHtml,
    "__tbd-insertion-target": document.querySelector(ctx.appendTo)
  };
  domUpdateEl({
    dynamic: {
      mapUsed: tbd_domElAtTtpShow,
      chunks: htmlElChunks
    }
  });
}

function domEffCloseTtp(ctx, ev, meta) {
  let ttpBox = document.querySelector(`.ttp-${ev.target}`);

  domUpdateEl({
    dynamic: {
      mapUsed: tbd_domElAtCloseTtp,
      chunks: {
        ttpName: ttpBox
      }
    }
  });
}

function composeTtp(ctx) {
  let { type, name } = ctx;
  ctx.outerHtml = `<div class='ttp ttp-${type} ttp-${name}'>
    <h5>${name}</h5>
    <p>Some text here</p>
<button class='ttp_close'>Click to close</button>
    </div>`;
}
let ttpActions = {
  createTtp: ctx =>
    [composeTtp, domEffAtShowTtp, ttpListenDismissBtn].forEach(fn => fn(ctx))
};

function setCustomEffects(ctx, ev) {
  let effectFns = [];
  if (!ctx.firstFired) effectFns.push(domEffectsAtShowTtp_first);

  if (ev.effect) effectFns.push(ev.effect);

  return effectFns;
}

let popoverCtrl_M = Machine(
  {
    id: "popoverCtrl",
    initial: "idle",
    context: {
      firstFired: false,
      activeTtp: {},
      lastTtp: "" // put here last ttp closed, not last opened
    },
    states: {
      pickState: {
        entry: ["logCtx"],
        on: {
          "": [{ target: "active", cond: "hasPopovers" }, { target: "idle" }]
        }
      },
      idle: {},
      active: {
        entry: ["log"],
        on: {
          "CLOSE.ALL": { target: "idle", actions: ["closeAll"] },
          "CLOSE.TTP": {
            actions: [
              "domEffCloseTtp",
              "removeThisActiveTtp",
              "setLastActiveTtp"
            ],
            target: "pickState"
          },
          "FIRED.FIRST": { actions: "firstFired" }
        }
      }
    },
    on: {
      "SHOW.TTP": [
        { target: "active", actions: ["createTtp"], cond: "isNeededNewTtp" }
      ]
    }
  },
  {
    actions: {
      firstFired: assign({ firstFired: true }),
      domEffCloseTtp,
      removeThisActiveTtp: assign({
        activeTtp: (ctx, ev) => {
          delete ctx.activeTtp[ev.target]; // does this mean I changed ctx directly instead of through assign ?!?
          console.log("removed " + ev.target + " from activeTtp");
          return ctx.activeTtp; // if I don't return this i get an error. why?
        }
      }),

      log: (ctx, ev, meta) => {
        console.log("in state active", meta.state.value);
      },
      logCtx: (ctx, ev) => {
        console.log("logging machine ctx", ctx);
      },

      setLastActiveTtp: assign({ lastTtp: (ctx, ev) => ev.target }),
      createTtp: assign({
        activeTtp: (ctx, ev) =>
          Object.assign(ctx.activeTtp, {
            [ev.ttpId]: spawn(
              ttpM.withContext({
                name: ev.ttpId,
                type: ev.ttpType,
                action: "createTtp",
                customEffects: setCustomEffects(ctx, ev),
                appendTo: ev.appendTo
              }),
              ev.ttpId
            )
          })
      })
    },
    guards: {
      hasPopovers: (ctx, ev) => {
        console.log("has popovers is ", ctx.activeTtp.length);
        return Boolean(Object.keys(ctx.activeTtp).length);
      },
      isNeededNewTtp: (ctx, ev) => {
        // true if ttpId is found in activeTtp
        return ctx.activeTtp[ev.ttpId] ? false : true;
      }
    }
  }
);

let ttpM = Machine(
  {
    id: "ttp",
    initial: "displayed",
    context: {
      type: "",
      name: "",
      action: "",
      appendTo: "",
      customEffects: []
    },
    states: {
      displayed: {
        entry: ["doAsAssigned", "customEff"]
      }
    }
  },
  {
    actions: {
      customEff: (ctx, ev, meta) =>
        ctx.customEffects.forEach(fn => fn(ctx, ev, meta)),
      doAsAssigned: ctx => ttpActions[ctx.action](ctx)
    }
  }
);

/*** start (parent) machine ***/
var popoverCtrl_S = interpret(popoverCtrl_M);
popoverCtrl_S.start();

/******* triggers from DOM ********/
ttpBox.addEventListener("click", e => {
  if (!e.target.classList.contains("ttp-trigger")) return;

  let ttpData = {
    ttpId: e.target.dataset.name,
    ttpType: ttpBox.dataset.ttpType,
    appendTo: "#ttp-box"
  };

  popoverCtrl_S.send("SHOW.TTP", ttpData);
});

function ttpListenDismissBtn(ctx) {
  const ttpName = ctx.name;
  const closeBtn = document.querySelector(`.ttp-${ttpName} .ttp_close`);

  closeBtn.addEventListener("click", e => {
    popoverCtrl_S.send({ type: "CLOSE.TTP", target: ttpName }); // will destroy at close
  });
}
