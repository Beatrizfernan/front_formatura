"use client";
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var react_1 = require("react");
var card_1 = require("@/components/ui/card");
var button_1 = require("@/components/ui/button");
var label_1 = require("@/components/ui/label");
var select_1 = require("@/components/ui/select");
var lucide_react_1 = require("lucide-react");
var alert_1 = require("@/components/ui/alert");
var allocation_stats_1 = require("@/components/allocation-stats");
var layout_1 = require("./layout");
var seat_map_1 = require("@/components/seat-map");
function Home() {
    var _this = this;
    var _a, _b, _c, _d;
    var _e = react_1.useState(null), arquivoSelecionado = _e[0], setArquivoSelecionado = _e[1];
    var _f = react_1.useState(""), localId = _f[0], setLocalId = _f[1];
    var _g = react_1.useState(false), loading = _g[0], setLoading = _g[1];
    var _h = react_1.useState(false), loadingPdf = _h[0], setLoadingPdf = _h[1];
    var _j = react_1.useState(null), error = _j[0], setError = _j[1];
    var _k = react_1.useState(null), result = _k[0], setResult = _k[1];
    var _l = react_1.useState([]), locais = _l[0], setLocais = _l[1];
    var _m = react_1.useState(true), loadingLocais = _m[0], setLoadingLocais = _m[1];
    var fileInputRef = react_1.useRef(null);
    var dragOverRef = react_1.useRef(null);
    var _o = react_1.useState(null), modifiedSeatMap = _o[0], setModifiedSeatMap = _o[1];
    // Buscar locais ao carregar a página
    react_1.useEffect(function () {
        var fetchLocais = function () { return __awaiter(_this, void 0, void 0, function () {
            var response, data, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, 4, 5]);
                        return [4 /*yield*/, fetch(layout_1.API_URL + "/listar_locais/")];
                    case 1:
                        response = _a.sent();
                        if (!response.ok)
                            throw new Error("Erro ao buscar locais");
                        return [4 /*yield*/, response.json()];
                    case 2:
                        data = _a.sent();
                        setLocais(data);
                        return [3 /*break*/, 5];
                    case 3:
                        err_1 = _a.sent();
                        console.error("Erro ao carregar locais:", err_1);
                        return [3 /*break*/, 5];
                    case 4:
                        setLoadingLocais(false);
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        }); };
        fetchLocais();
    }, []);
    var handleFileSelect = function (file) {
        if (!file) {
            setArquivoSelecionado(null);
            return;
        }
        // Validar tipo de arquivo
        var allowedTypes = [
            "text/csv",
            "text/plain",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel"
        ];
        if (!allowedTypes.includes(file.type)) {
            setError("Por favor, selecione um arquivo CSV ou Excel válido");
            setTimeout(function () { return setError(null); }, 4000);
            return;
        }
        // Validar tamanho (máximo 5MB)
        if (file.size > 5 * 1024 * 1024) {
            setError("O arquivo deve ter menos de 5MB");
            setTimeout(function () { return setError(null); }, 4000);
            return;
        }
        setArquivoSelecionado(file);
        setError(null);
    };
    var handleDragOver = function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (dragOverRef.current) {
            dragOverRef.current.classList.add("border-primary", "bg-primary/5");
        }
    };
    var handleDragLeave = function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (dragOverRef.current) {
            dragOverRef.current.classList.remove("border-primary", "bg-primary/5");
        }
    };
    var handleDrop = function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (dragOverRef.current) {
            dragOverRef.current.classList.remove("border-primary", "bg-primary/5");
        }
        var files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    };
    var handleSubmit = function (e) { return __awaiter(_this, void 0, void 0, function () {
        var formData, response, data, err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    e.preventDefault();
                    if (!arquivoSelecionado) {
                        setError("Por favor, selecione um arquivo");
                        return [2 /*return*/];
                    }
                    if (!localId) {
                        setError("Por favor, selecione um local");
                        return [2 /*return*/];
                    }
                    setLoading(true);
                    setError(null);
                    setResult(null);
                    setModifiedSeatMap(null);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, 5, 6]);
                    formData = new FormData();
                    formData.append("arquivo", arquivoSelecionado);
                    formData.append("local_id", localId);
                    return [4 /*yield*/, fetch(layout_1.API_URL + "/api/planilha/processar", {
                            method: "POST",
                            body: formData
                        })];
                case 2:
                    response = _a.sent();
                    return [4 /*yield*/, response.json()];
                case 3:
                    data = _a.sent();
                    if (!response.ok) {
                        throw new Error(data.error || "Erro ao processar planilha");
                    }
                    setResult(data);
                    return [3 /*break*/, 6];
                case 4:
                    err_2 = _a.sent();
                    setError(err_2 instanceof Error ? err_2.message : "Erro desconhecido");
                    return [3 /*break*/, 6];
                case 5:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    var handleSeatMapStateChange = function (newSeatMap) {
        setModifiedSeatMap(newSeatMap);
    };
    var handleDownload = function () { return __awaiter(_this, void 0, void 0, function () {
        var formaturaId, response, errorData, blob, url, link, err_3;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!result || !((_a = result.formatura) === null || _a === void 0 ? void 0 : _a.id)) {
                        setError('Dados da formatura não disponíveis');
                        return [2 /*return*/];
                    }
                    setLoadingPdf(true);
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 6, 7, 8]);
                    formaturaId = result.formatura.id;
                    return [4 /*yield*/, fetch(layout_1.API_URL + "/api/pdf/mapa-assentos/" + formaturaId, {
                            method: 'GET',
                            headers: {
                                'Accept': 'application/pdf'
                            }
                        })];
                case 2:
                    response = _b.sent();
                    if (!!response.ok) return [3 /*break*/, 4];
                    return [4 /*yield*/, response.json()];
                case 3:
                    errorData = _b.sent();
                    throw new Error(errorData.error || 'Erro ao gerar PDF');
                case 4: return [4 /*yield*/, response.blob()];
                case 5:
                    blob = _b.sent();
                    url = window.URL.createObjectURL(blob);
                    link = document.createElement('a');
                    link.href = url;
                    link.download = "mapa-assentos-" + result.formatura.nome.replace(/\s+/g, '-') + ".pdf";
                    // Trigger download
                    document.body.appendChild(link);
                    link.click();
                    // Cleanup
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(url);
                    return [3 /*break*/, 8];
                case 6:
                    err_3 = _b.sent();
                    console.error('Erro ao baixar PDF:', err_3);
                    setError(err_3 instanceof Error
                        ? err_3.message
                        : 'Não foi possível gerar o PDF. Tente novamente.');
                    setTimeout(function () { return setError(null); }, 5000);
                    return [3 /*break*/, 8];
                case 7:
                    setLoadingPdf(false);
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/];
            }
        });
    }); };
    return (react_1["default"].createElement("main", { className: "min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-8" },
        react_1["default"].createElement("div", { className: "mx-auto max-w-7xl space-y-8" },
            react_1["default"].createElement("div", { className: "flex items-start justify-between gap-6" },
                react_1["default"].createElement("div", { className: "flex-1 space-y-2" },
                    react_1["default"].createElement("h1", { className: "text-4xl font-bold tracking-tight" }, "Sistema de Aloca\u00E7\u00E3o de Assentos"),
                    react_1["default"].createElement("p", { className: "text-muted-foreground text-lg" }, "Gerencie a distribui\u00E7\u00E3o de assentos para formaturas")),
                react_1["default"].createElement(button_1.Button, { variant: "outline", size: "lg", onClick: function () { return window.location.href = '/criar-local'; }, className: "shrink-0" },
                    react_1["default"].createElement(lucide_react_1.Plus, { className: "mr-2 h-5 w-5" }),
                    "Novo Local")),
            react_1["default"].createElement(card_1.Card, { className: "shadow-lg" },
                react_1["default"].createElement(card_1.CardHeader, null,
                    react_1["default"].createElement(card_1.CardTitle, null, "Processar Planilha"),
                    react_1["default"].createElement(card_1.CardDescription, null, "Fa\u00E7a upload da planilha e selecione o local para gerar a aloca\u00E7\u00E3o")),
                react_1["default"].createElement(card_1.CardContent, null,
                    react_1["default"].createElement("form", { onSubmit: handleSubmit, className: "space-y-6" },
                        react_1["default"].createElement("div", { className: "space-y-2" },
                            react_1["default"].createElement(label_1.Label, null, "Arquivo da Planilha *"),
                            react_1["default"].createElement("div", { ref: dragOverRef, onDragOver: handleDragOver, onDragLeave: handleDragLeave, onDrop: handleDrop, className: "relative border-2 border-dashed border-border rounded-lg p-8 transition-colors cursor-pointer hover:border-primary/50 hover:bg-primary/5", onClick: function () { var _a; return (_a = fileInputRef.current) === null || _a === void 0 ? void 0 : _a.click(); } },
                                react_1["default"].createElement("input", { ref: fileInputRef, type: "file", accept: ".csv,.xlsx,.xls", onChange: function (e) { var _a; return handleFileSelect(((_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0]) || null); }, className: "hidden" }),
                                react_1["default"].createElement("div", { className: "flex flex-col items-center justify-center gap-3" },
                                    react_1["default"].createElement("div", { className: "rounded-full bg-primary/10 p-3" },
                                        react_1["default"].createElement(lucide_react_1.Upload, { className: "h-6 w-6 text-primary" })),
                                    react_1["default"].createElement("div", { className: "text-center" },
                                        react_1["default"].createElement("p", { className: "font-semibold" }, "Arraste o arquivo aqui ou clique para selecionar"),
                                        react_1["default"].createElement("p", { className: "text-sm text-muted-foreground mt-1" }, "Aceita CSV ou Excel (m\u00E1ximo 5MB)")))),
                            arquivoSelecionado && (react_1["default"].createElement("div", { className: "flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg" },
                                react_1["default"].createElement("div", { className: "flex items-center gap-2" },
                                    react_1["default"].createElement("div", { className: "text-green-600" }, "\u2713"),
                                    react_1["default"].createElement("div", null,
                                        react_1["default"].createElement("p", { className: "text-sm font-medium text-green-900" }, arquivoSelecionado.name),
                                        react_1["default"].createElement("p", { className: "text-xs text-green-700" },
                                            (arquivoSelecionado.size / 1024).toFixed(2),
                                            " KB"))),
                                react_1["default"].createElement(button_1.Button, { type: "button", variant: "ghost", size: "icon", onClick: function () { return setArquivoSelecionado(null); }, className: "h-8 w-8" },
                                    react_1["default"].createElement(lucide_react_1.X, { className: "h-4 w-4" }))))),
                        react_1["default"].createElement("div", { className: "space-y-2" },
                            react_1["default"].createElement(label_1.Label, { htmlFor: "local-id" }, "Local *"),
                            react_1["default"].createElement(select_1.Select, { value: localId, onValueChange: setLocalId, disabled: loading || loadingLocais },
                                react_1["default"].createElement(select_1.SelectTrigger, { id: "local-id" },
                                    react_1["default"].createElement(select_1.SelectValue, { placeholder: loadingLocais ? "Carregando locais..." : "Selecione um local" })),
                                react_1["default"].createElement(select_1.SelectContent, null, locais.map(function (local) { return (react_1["default"].createElement(select_1.SelectItem, { key: local.id, value: local.id },
                                    local.nome,
                                    local.capacidade && " (" + local.capacidade + " lugares)")); })))),
                        error && (react_1["default"].createElement(alert_1.Alert, { variant: "destructive" },
                            react_1["default"].createElement(lucide_react_1.AlertCircle, { className: "h-4 w-4" }),
                            react_1["default"].createElement(alert_1.AlertDescription, null, error))),
                        react_1["default"].createElement(button_1.Button, { type: "submit", className: "w-full", disabled: loading || !localId || !arquivoSelecionado, size: "lg" }, loading ? (react_1["default"].createElement(react_1["default"].Fragment, null,
                            react_1["default"].createElement("div", { className: "animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" }),
                            "Processando...")) : ("Gerar Alocação"))))),
            result && (react_1["default"].createElement("div", { className: "space-y-6" },
                react_1["default"].createElement("div", { className: "grid gap-4 md:grid-cols-3" },
                    react_1["default"].createElement(card_1.Card, null,
                        react_1["default"].createElement(card_1.CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2" },
                            react_1["default"].createElement(card_1.CardTitle, { className: "text-sm font-medium" }, "Formatura"),
                            react_1["default"].createElement(lucide_react_1.Calendar, { className: "h-4 w-4 text-muted-foreground" })),
                        react_1["default"].createElement(card_1.CardContent, null,
                            react_1["default"].createElement("div", { className: "text-2xl font-bold text-balance" }, result.formatura.nome),
                            react_1["default"].createElement("p", { className: "text-xs text-muted-foreground mt-1" }, new Date(result.formatura.data).toLocaleDateString("pt-BR")))),
                    react_1["default"].createElement(card_1.Card, null,
                        react_1["default"].createElement(card_1.CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2" },
                            react_1["default"].createElement(card_1.CardTitle, { className: "text-sm font-medium" }, "Local"),
                            react_1["default"].createElement(lucide_react_1.MapPin, { className: "h-4 w-4 text-muted-foreground" })),
                        react_1["default"].createElement(card_1.CardContent, null,
                            react_1["default"].createElement("div", { className: "text-2xl font-bold" }, result.formatura.local),
                            react_1["default"].createElement("p", { className: "text-xs text-muted-foreground mt-1" },
                                "Taxa de ocupa\u00E7\u00E3o: ",
                                ((_a = result.alocacao) === null || _a === void 0 ? void 0 : _a.taxa_ocupacao) || 'N/A'))),
                    react_1["default"].createElement(card_1.Card, null,
                        react_1["default"].createElement(card_1.CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2" },
                            react_1["default"].createElement(card_1.CardTitle, { className: "text-sm font-medium" }, "Formandos"),
                            react_1["default"].createElement(lucide_react_1.Users, { className: "h-4 w-4 text-muted-foreground" })),
                        react_1["default"].createElement(card_1.CardContent, null,
                            react_1["default"].createElement("div", { className: "text-2xl font-bold" }, result.formatura.total_formandos),
                            react_1["default"].createElement("p", { className: "text-xs text-muted-foreground mt-1" },
                                ((_b = result.alocacao) === null || _b === void 0 ? void 0 : _b.total_alocado) || 0,
                                " assentos alocados")))),
                ((_c = result.alocacao) === null || _c === void 0 ? void 0 : _c.detalhes) && (react_1["default"].createElement(allocation_stats_1.AllocationStats, { details: result.alocacao.detalhes })),
                ((_d = result.alocacao) === null || _d === void 0 ? void 0 : _d.detalhes) && (react_1["default"].createElement(card_1.Card, { className: "shadow-lg" },
                    react_1["default"].createElement(card_1.CardHeader, { className: "flex flex-row items-center justify-between" },
                        react_1["default"].createElement("div", null,
                            react_1["default"].createElement(card_1.CardTitle, null, "Mapa de Assentos"),
                            react_1["default"].createElement(card_1.CardDescription, null, "Clique em uma turma e arraste para outro local")),
                        react_1["default"].createElement(button_1.Button, { variant: "outline", size: "sm", onClick: handleDownload, disabled: loadingPdf }, loadingPdf ? (react_1["default"].createElement(react_1["default"].Fragment, null,
                            react_1["default"].createElement("div", { className: "animate-spin rounded-full h-4 w-4 border-b-2 border-foreground mr-2" }),
                            "Gerando PDF...")) : (react_1["default"].createElement(react_1["default"].Fragment, null,
                            react_1["default"].createElement(lucide_react_1.Download, { className: "mr-2 h-4 w-4" }),
                            "Exportar PDF")))),
                    react_1["default"].createElement(card_1.CardContent, null,
                        react_1["default"].createElement(seat_map_1["default"], { details: result.alocacao.detalhes, assentosVazios: result.alocacao.assentos_vazios || [], onStateChange: handleSeatMapStateChange })))),
                !result.alocacao && (react_1["default"].createElement(alert_1.Alert, null,
                    react_1["default"].createElement(lucide_react_1.AlertCircle, { className: "h-4 w-4" }),
                    react_1["default"].createElement(alert_1.AlertDescription, null, "Nenhuma aloca\u00E7\u00E3o foi gerada para esta formatura."))))))));
}
exports["default"] = Home;
