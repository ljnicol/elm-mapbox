import mapboxgl from "mapbox-gl";

function wrapElmApplication(elmApp, settings = {}) {
  const options = Object.assign(
    {
      outgoingPort: "elmMapboxOutgoing",
      incomingPort: "elmMapboxIncoming",
      easingFunctions: {
        linear: t => t
      }
    },
    settings
  );

  if (options.token) {
    mapboxgl.token = options.token;
  }
  window.customElements.define(
    "elm-mapbox-map",
    class MapboxMap extends window.HTMLElement {
      constructor() {
        super();
        this._refreshExpiredTiles = true;
        this._renderWorldCopies = true;
        this.interactive = true;
        this._eventRegistrationQueue = {};
        this._eventListenerMap = new Map();
      }

      get mapboxStyle() {
        return this._style;
      }
      set mapboxStyle(value) {
        if (this._map) this._map.setStyle(value);
        this._style = value;
      }

      get minZoom() {
        return this._minZoom;
      }
      set minZoom(value) {
        if (this._map) this._map.setMinZoom(value);
        this._minZoom = value;
      }

      get maxZoom() {
        return this._maxZoom;
      }
      set maxZoom(value) {
        if (this._map) this._map.setMaxZoom(value);
        this._maxZoom = value;
      }

      get map() {
        return this._map;
      }

      get maxBounds() {
        return this._maxBounds;
      }
      set maxBounds(value) {
        if (this._map) this._map.setBounds(value);
        this._maxBounds = value;
      }

      get renderWorldCopies() {
        return this._renderWorldCopies;
      }
      set renderWorldCopies(value) {
        if (this._map) this._map.setRenderWorldCopies(value);
        this._renderWorldCopies = value;
      }

      get center() {
        return this._center;
      }
      set center(value) {
        if (this._map) this._map.setCenter(value);
        this._center = value;
      }

      get zoom() {
        return this._zoom;
      }
      set zoom(value) {
        if (this._map) this._map.setZoom(value);
        this._zoom = value;
      }

      get bearing() {
        return this._bearing;
      }
      set bearing(value) {
        if (this._map) this._map.setBearing(value);
        this._bearing = value;
      }

      get pitch() {
        return this._pitch;
      }
      set pitch(value) {
        if (this._map) this._map.setPitch(value);
        this._pitch = value;
      }

      get featureState() {
        return this._featureState;
      }
      set featureState(value) {
        // TODO: Clean this up
        function makeId({id, source, sourceLayer}) {
          return `${id}::${source}::${sourceLayer}`;
        }
        if (this._map) {
          const map = new Map(this._featureState.map(([feature, state]) => [makeId(feature), {feature, state}]));
          value.forEach(([feature, state]) => {
            const id = makeId(feature);
            if (map.has(id)) {
              const prevValue = map.get(id).state;
              const keys = Object.keys(prevValue);
              let newValue = {};
              keys.forEach(k => {
                if (state[k] === undefined) {
                  newValue[k] = undefined;
                }
              });
              this._map.setFeatureState(
                feature,
                Object.assign(newValue, state)
              );
            } else {
              this._map.setFeatureState(feature, state);
            }
            map.delete(id);
          });

          map.forEach(({feature, state}) => {
            const keys = Object.keys(state);
            let newValue = {};
            keys.forEach(k => {
              newValue[k] = undefined;
            });
            this._map.setFeatureState(feature, newValue);
          });
        }

        this._featureState = value;
      }

      addEventListener(type, fn, ...args) {
        if (this._map) {
          var wrapped;
          if (
            [
              "mousedown",
              "mouseup",
              "mouseover",
              "mousemove",
              "click",
              "dblclick",
              "mouseout",
              "contextmenu",
              "zoom",
              "zoomstart",
              "zoomend",
              "rotate",
              "rotatestart",
              "rotateend"
            ].includes(type)
          ) {
            wrapped = e => {
              e.features = this._map.queryRenderedFeatures(
                [e.lngLat.lng, e.lngLat.lat],
                {
                  layers: this.eventFeaturesLayers,
                  filter: this.eventFeaturesFilter
                }
              );
              return fn(e);
            };
          } else if (["touchend", "touchmove", "touchcancel"].includes(type)) {
            wrapped = e => {
              e.features = this._map.queryRenderedFeatures(
                [e.lngLat.lng, e.lngLat.lat],
                {
                  layers: this.eventFeaturesLayers,
                  filter: this.eventFeaturesFilter
                }
              );
              e.perPointFeatures = e.lngLats.map(({ lng, lat }) =>
                this._map.queryRenderedFeatures([lng, lat], {
                  layers: this.eventFeaturesLayers,
                  filter: this.eventFeaturesFilter
                })
              );
              return fn(e);
            };
          } else {
            wrapped = fn;
          }
          this._eventListenerMap.set(fn, wrapped);
          return this._map.on(type, wrapped);
        } else {
          this._eventRegistrationQueue[type] =
            this._eventRegistrationQueue[type] || [];
          return this._eventRegistrationQueue[type].push(fn);
        }
      }

      removeEventListener(type, fn, ...args) {
        if (this._map) {
          const wrapped = this._eventListenerMap.get(fn);
          this._eventListenerMap.delete(fn);
          return this._map.off(type, wrapped);
        } else {
          const queue = this._eventRegistrationQueue[type] || [];
          const index = queue.findIndex(fn);
          if (index >= 0) {
            queue.splice(index, 1);
          }
          return;
        }
      }

      _createMapInstance() {
        let options = {
          container: this,
          style: this._style,
          minZoom: this._minZoom || 0,
          maxZoom: this._maxZoom || 22,
          interactive: this.interactive,
          attributionControl: false,
          logoPosition: this.logoPosition || "bottom-left",
          refreshExpiredTiles: this._refreshExpiredTiles,
          maxBounds: this._maxBounds,
          renderWorldCopies: this._renderWorldCopies
        };
        if (this._center) {
          options.center = this._center;
        }
        if (this._zoom) {
          options.zoom = this._zoom;
        }
        if (this._bearing) {
          options.bearing = this._bearing;
        }
        if (this._pitch) {
          options.pitch = this._pitch;
        }
        this._map = new mapboxgl.Map(options);

        Object.entries(this._eventRegistrationQueue).forEach(
          ([type, listeners]) => {
            listeners.forEach(listener => {
              this.addEventListener(type, listener);
            });
          }
        );
        this._eventRegistrationQueue = {};
        return this._map;
      }

      connectedCallback() {
        if (this.token) {
          mapboxgl.accessToken = this.token;
        }
        this.style.display = "block";
        this.style.width = "100%";
        this.style.height = "100%";
        this._map = this._createMapInstance();
      }

      disconnectedCallback() {
        this._map.remove();
        delete this._map;
      }
    }
  );

  if (elmApp.ports && elmApp.ports.elmMapboxOutgoing) {
    function processOptions(opts) {
      if (opts.easing) {
        return Object.assign({}, opts, {
          easing: options.easingFunctions[opts.easing]
        });
      }
      return opts;
    }

    elmApp.ports[options.outgoingPort].subscribe(event => {
      var map = document.getElementById(event.target).map;
      switch (event.command) {
        case "resize":
          return map.resize();

        case "fitBounds":
          return map.fitBounds(event.bounds, processOptions(event.options));

        case "panBy":
          return map.panBy(event.offset, processOptions(event.options));

        case "panTo":
          return map.panTo(event.location, processOptions(event.options));

        case "zoomTo":
          return map.zoomTo(event.zoom, processOptions(event.options));

        case "zoomIn":
          return map.zoomIn(processOptions(event.options));

        case "zoomOut":
          return map.zoomOut(processOptions(event.options));

        case "rotateTo":
          return map.rotateTo(event.bearing, processOptions(event.options));

        case "jumpTo":
          return map.jumpTo(processOptions(event.options));

        case "easeTo":
          return map.easeTo(processOptions(event.options));

        case "flyTo":
          return map.flyTo(processOptions(event.options));

        case "stop":
          return map.stop();

        case "setRTLTextPlugin":
          return map.setRTLTextPlugin(event.url);

        case "getBounds":
          return elmApp.ports[options.incomingPort].send({
            type: "getBounds",
            id: event.requestId,
            bounds: map.getBounds().toArray()
          });

        case "queryRenderedFeatures":
          return elmApp.ports[options.incomingPort].send({
            type: "queryRenderedFeatures",
            id: event.requestId,
            features:
              event.query === "viewport"
                ? map.queryRenderedFeatures(processOptions(event.options))
                : map.queryRenderedFeatures(
                    event.query,
                    processOptions(event.options)
                  )
          });
      }
    });
  }

  return elmApp;
}

wrapElmApplication.supported = mapboxgl.supported;

export default wrapElmApplication;
