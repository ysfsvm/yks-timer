/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

/* exported init */
"use strict";

const SEC_IN_MINUTE = 60;
const SEC_IN_HOUR = SEC_IN_MINUTE * 60;
const SEC_IN_DAY = SEC_IN_HOUR * 24;

const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;

const Lang = imports.lang;
const Mainloop = imports.mainloop;

const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();

const IconsEmotes = {
    angel: "face-angel-symbolic",
    cool: "face-cool-symbolic",
    smile: "face-smile-symbolic",
    plain: "face-plain-symbolic",
    worried: "face-worried-symbolic",
    surprise: "face-surprise-symbolic",
    sick: "face-sick-symbolic",
};

const LabelsTime = {
    before: "CHILLOUT",
    days: "{0}d {1}h ({2}%)",
    hours: "{0}h {1}m ({2}%)",
    minutes: "{0}m {1}s ({2}%)",
    deadline: "DEADLINE!",
};

const FeelingTiers = {
    0: "cool",
    30: "smile",
    60: "plain",
    90: "worried",
    95: "surprise",
};

class Extension {
    // ---------------------------------------------------------------
    constructor() {
        this._indicator = null;
        this._timeout = null;
        this._box = null;
        this._icons = {};
        this._label = null;

        this._beginTimestamp = null;
        this._endTimestamp = null;
        this._period = null;
    }

    // ---------------------------------------------------------------
    enable() {
        log(`(*) enabling ${Me.metadata.name}`);

        // read dates from prefs.json
        this._read_prefs();

        // unique indicator name
        let indicatorName = `${Me.metadata.name} Indicator`;

        // create panel button
        this._indicator = new PanelMenu.Button(0.0, indicatorName, false);

        // create box
        this._box = new St.BoxLayout();
        this._indicator.add_child(this._box);

        // create icons
        Object.keys(IconsEmotes).forEach((key) => {
            this._icons[key] = new St.Icon({
                gicon: new Gio.ThemedIcon({
                    name: IconsEmotes[key],
                }),
                style_class: `system-status-icon deadline-timer-icon-${key}`,
                y_align: Clutter.ActorAlign.CENTER,
            });
            this._box.add_child(this._icons[key]);
        });

        // create label
        this._label = new St.Label({
            text: Me.metadata.name,
            style_class: "ns-horizontal-label",
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._box.add_child(this._label);

        // register timeout function
        this._on_timeout();
        this._timeout = Mainloop.timeout_add_seconds(
            1,
            Lang.bind(this, this._on_timeout)
        );

        // add indicator to panel
        Main.panel.addToStatusArea(indicatorName, this._indicator);
    }

    // ---------------------------------------------------------------
    disable() {
        log(`(*) disabling ${Me.metadata.name}`);

        // remove timeout
        if (this._timeout) {
            Mainloop.source_remove(this._timeout);
            this._timeout = null;
        }

        // remove indicator
        this._indicator.destroy();
        this._indicator = null;
    }

    // ---------------------------------------------------------------
    _on_timeout() {
        let currentTimestamp = Math.floor(new Date().getTime() / 1000);
        let diffBeginTimestamp = currentTimestamp - this._beginTimestamp;
        let diffEndTimestamp = this._endTimestamp - currentTimestamp;

        // check if too early
        if (diffBeginTimestamp < 0) {
            this._label.text = LabelsTime.before;
            this._show_icon("angel");
            return true;
        }

        // check if past deadline
        if (diffEndTimestamp < 0) {
            this._label.text = LabelsTime.deadline;
            this._show_icon("sick");
            return true;
        }

        // calculate timers
        let secondsLeft = diffEndTimestamp;

        let daysLeft = Math.floor(secondsLeft / SEC_IN_DAY);
        secondsLeft -= daysLeft * SEC_IN_DAY;

        let hoursLeft = Math.floor(secondsLeft / SEC_IN_HOUR);
        secondsLeft -= hoursLeft * SEC_IN_HOUR;

        let minutesLeft = Math.floor(secondsLeft / SEC_IN_MINUTE);
        secondsLeft -= minutesLeft * SEC_IN_MINUTE;

        // calculate percent passed
        let percentPass = 100.0 - (diffEndTimestamp / this._period) * 100.0;
        if (percentPass > 99.0) {
            percentPass = percentPass.toFixed(2);
        } else {
            percentPass = Math.round(percentPass);
        }

        // labels
        if (diffEndTimestamp < SEC_IN_HOUR) {
            this._set_label(LabelsTime.minutes, [
                minutesLeft,
                secondsLeft,
                percentPass,
            ]);
        } else if (diffEndTimestamp < SEC_IN_DAY) {
            this._set_label(LabelsTime.hours, [
                hoursLeft,
                minutesLeft,
                percentPass,
            ]);
        } else {
            this._set_label(LabelsTime.days, [
                daysLeft,
                hoursLeft,
                percentPass,
            ]);
        }

        // icons
        let icon = null;
        Object.keys(FeelingTiers).forEach((threshold) => {
            if (percentPass >= threshold) {
                icon = FeelingTiers[threshold];
            }
        });
        this._show_icon(icon);

        return true;
    }

    // ---------------------------------------------------------------
    _set_label(template, args) {
        this._label.text = template.replace(/{(\d+)}/g, function (match, idx) {
            return args[idx];
        });
    }

    // ---------------------------------------------------------------
    _show_icon(name) {
        Object.keys(this._icons).forEach((key) => {
            if (key === name) {
                this._icons[key].show();
            } else {
                this._icons[key].hide();
            }
        });
    }

    // ---------------------------------------------------------------
    _read_prefs() {
        let status, data, text, prefs;
        let file = Me.dir.get_child("prefs.json");
        [status, data] = file.load_contents(null);
        text = String.fromCharCode.apply(null, data);
        prefs = JSON.parse(text);

        // UTC timestamps from prefs
        const TIMESTAMP_BEGIN = Math.floor(
            new Date(
                Date.UTC(
                    prefs.utcDateBegin[0],
                    prefs.utcDateBegin[1] - 1,
                    prefs.utcDateBegin[2],
                    prefs.utcDateBegin[3],
                    prefs.utcDateBegin[4]
                )
            ) / 1000
        );
        const TIMESTAMP_END = Math.floor(
            new Date(
                Date.UTC(
                    prefs.utcDateEnd[0],
                    prefs.utcDateEnd[1] - 1,
                    prefs.utcDateEnd[2],
                    prefs.utcDateEnd[3],
                    prefs.utcDateEnd[4]
                )
            ) / 1000
        );

        // info
        log(new Date(TIMESTAMP_BEGIN * 1000).toUTCString());
        log(new Date(TIMESTAMP_END * 1000).toUTCString());

        // prepare timestamps
        this._beginTimestamp = Math.min(TIMESTAMP_BEGIN, TIMESTAMP_END);
        this._endTimestamp = Math.max(TIMESTAMP_BEGIN, TIMESTAMP_END);
        this._period = this._endTimestamp - this._beginTimestamp;
    }
}

// ---------------------------------------------------------------
function init() {
    log(`(*) initializing ${Me.metadata.name}`);
    return new Extension();
}

/* EoF */
