"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var client_1 = require("react-dom/client");
var react_router_dom_1 = require("react-router-dom");
var App_tsx_1 = require("./App.tsx");
require("./index.css");
client_1.default.createRoot(document.getElementById('root')).render(<react_1.default.StrictMode>
    <react_router_dom_1.BrowserRouter>
      <App_tsx_1.default />
    </react_router_dom_1.BrowserRouter>
  </react_1.default.StrictMode>);
