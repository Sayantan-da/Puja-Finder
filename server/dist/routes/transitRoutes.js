"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const transitController_1 = require("../controllers/transitController");
const router = (0, express_1.Router)();
// Pandal Transit Info: nearest metro station, exit gate, walking distance, crowd status
router.get('/pandals/:id/transit', transitController_1.getPandalTransit);
// Crowdsourced parking availability vote: [YES / NO] (full / available)
router.post('/parking/:id/vote', transitController_1.voteParking);
// Schedules for Metro and Special Night Buses
router.get('/transit/schedules', transitController_1.getSchedules);
// Traffic restrictions (pedestrian-only GeoJSON zones) and parking lots
router.get('/transit/traffic-parking', transitController_1.getTrafficAndParking);
exports.default = router;
