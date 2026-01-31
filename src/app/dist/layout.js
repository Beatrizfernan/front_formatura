"use strict";
exports.__esModule = true;
exports.API_URL = void 0;
require("./globals.css");
var google_1 = require("next/font/google");
var inter = google_1.Inter({ subsets: ['latin'] });
// export const metadata = {
//   title: 'Formatura',
//   description: 'Sistema de alocação de assentos',
// }
function RootLayout(_a) {
    var children = _a.children;
    return (React.createElement("html", { lang: "pt-BR" },
        React.createElement("body", { className: inter.className }, children)));
}
exports["default"] = RootLayout;
exports.API_URL = "http://127.0.0.1:5000";
