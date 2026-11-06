/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * SPDX-FileCopyrightText: 2024-2025 Univention GmbH
 * SPDX-FileCopyrightText: 2026 openEDU Team
 */

const backchannelLogout = require("./backchannelLogout");
const fs = require("./fs");
const oc = require("./oc");
const wiki = require("./wiki");
const nob = require("./nob");
const navigation = require("./navigation");
const silent = require("./silent");
const uuid = require("./uuid");
const sogo = require("./sogo");
const ilias = require("./ilias");
const nc = require("./nc");
const webdav = require("./webdav");

module.exports = {
  backchannelLogout,
  fs,
  oc,
  wiki,
  nob,
  navigation,
  silent,
  uuid,
  sogo,
  ilias,
  nc,
  webdav,
};
