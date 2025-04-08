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

import St from 'gi://St';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const SEC_IN_MINUTE = 60;
const SEC_IN_HOUR = SEC_IN_MINUTE * 60;
const SEC_IN_DAY = SEC_IN_HOUR * 24;

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

export default class DeadlineTimerExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this._indicator = null;
        this._timeout = null;
        this._box = null;
        this._icons = {};
        this._label = null;

        this._beginTimestamp = null;
        this._endTimestamp = null;
        this._period = null;
    }

    _createIndicator() {
        let indicatorName = `${this.metadata.name} Indicator`;

        this._indicator = new PanelMenu.Button(0.0, indicatorName, false);

        this._box = new St.BoxLayout();
        this._indicator.add_child(this._box);

        Object.keys(IconsEmotes).forEach((key) => {
            this._icons[key] = new St.Icon({
                gicon: new Gio.ThemedIcon({
                    name: IconsEmotes[key],
                }),
                style_class: 'system-status-icon',
                y_align: Clutter.ActorAlign.CENTER,
            });
            this._box.add_child(this._icons[key]);
        });

        this._label = new St.Label({
            text: this.metadata.name,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._box.add_child(this._label);

        const position = this.getSettings().get_string('bar-position');
        Main.panel.addToStatusArea(indicatorName, this._indicator, 0, position);
    }

    _onSettingsChanged(settings, key) {
        if (key === 'bar-position') {
            if (this._indicator) {
                this._indicator.destroy();
                this._indicator = null;
            }
            this._createIndicator();
        } else {
            this._read_settings();
        }
        
        this._on_timeout();
    }

    enable() {
        this._settings = this.getSettings();
        this._createIndicator();
        this._read_settings();
        this._on_timeout();
        this._timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            this._on_timeout();
            return GLib.SOURCE_CONTINUE;
        });
        this._settings.connect('changed', this._onSettingsChanged.bind(this));
    }

    disable() {
        if (this._timeout) {
            GLib.Source.remove(this._timeout);
            this._timeout = null;
        }

        if (this._settings) {
            this._settings.disconnect('changed', this._onSettingsChanged.bind(this));
            this._settings = null;
        }

        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }

        if (this._box) {
            this._box.destroy();
            this._box = null;
        }

        Object.keys(this._icons).forEach(key => {
            if (this._icons[key]) {
                this._icons[key].destroy();
                this._icons[key] = null;
            }
        });
        this._icons = {};

        if (this._label) {
            this._label.destroy();
            this._label = null;
        }

        this._beginTimestamp = null;
        this._endTimestamp = null;
        this._period = null;
    }

    _read_settings() {
        const startDateStr = this._settings.get_string('start-date');
        const endDateStr = this._settings.get_string('end-date');

        if (startDateStr && endDateStr) {
            try {
                const [startYear, startMonth, startDay] = startDateStr.split('-').map(Number);
                const [endYear, endMonth, endDay] = endDateStr.split('-').map(Number);

                this._beginTimestamp = new Date(startYear, startMonth - 1, startDay).getTime() / 1000;
                this._endTimestamp = new Date(endYear, endMonth - 1, endDay).getTime() / 1000;

                if (isNaN(this._beginTimestamp) || isNaN(this._endTimestamp)) {
                    throw new Error('Invalid date values');
                }

                this._period = this._endTimestamp - this._beginTimestamp;
                if (this._period <= 0) {
                    throw new Error('End date must be after start date');
                }
            } catch (e) {
                log(`Deadline Timer: Error parsing dates: ${e.message}`);
                this._beginTimestamp = null;
                this._endTimestamp = null;
                this._period = null;
            }
        } else {
            log('Deadline Timer: Please set start and end dates in preferences');
            this._beginTimestamp = null;
            this._endTimestamp = null;
            this._period = null;
        }
    }

    _on_timeout() {
        if (!this._beginTimestamp || !this._endTimestamp || !this._period) {
            this._label.text = 'Invalid dates';
            this._show_icon("sick");
            return;
        }

        let currentTimestamp = Math.floor(new Date().getTime() / 1000);
        let diffBeginTimestamp = currentTimestamp - this._beginTimestamp;
        let diffEndTimestamp = this._endTimestamp - currentTimestamp;

        if (diffBeginTimestamp < 0) {
            this._label.text = LabelsTime.before;
            this._show_icon("angel");
            return;
        }

        if (diffEndTimestamp < 0) {
            this._label.text = LabelsTime.deadline;
            this._show_icon("sick");
            return;
        }

        let secondsLeft = diffEndTimestamp;

        let daysLeft = Math.floor(secondsLeft / SEC_IN_DAY);
        secondsLeft -= daysLeft * SEC_IN_DAY;

        let hoursLeft = Math.floor(secondsLeft / SEC_IN_HOUR);
        secondsLeft -= hoursLeft * SEC_IN_HOUR;

        let minutesLeft = Math.floor(secondsLeft / SEC_IN_MINUTE);
        secondsLeft -= minutesLeft * SEC_IN_MINUTE;

        let percentPass = 100.0 - (diffEndTimestamp / this._period) * 100.0;
        if (percentPass > 99.0) {
            percentPass = percentPass.toFixed(2);
        } else {
            percentPass = Math.round(percentPass);
        }

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

        let icon = null;
        Object.keys(FeelingTiers).forEach((threshold) => {
            if (percentPass >= threshold) {
                icon = FeelingTiers[threshold];
            }
        });
        this._show_icon(icon);
    }

    _set_label(template, args) {
        this._label.text = template.replace(/{(\d+)}/g, function (match, idx) {
            return args[idx];
        });
    }

    _show_icon(name) {
        Object.keys(this._icons).forEach((key) => {
            if (key === name) {
                this._icons[key].show();
            } else {
                this._icons[key].hide();
            }
        });
    }
}