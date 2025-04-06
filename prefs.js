import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class YKSTimerPreferences extends ExtensionPreferences {
    constructor(metadata) {
        super(metadata);
    }

    fillPreferencesWindow(window) {
        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup();
        page.add(group);

        // Bar Position
        const barPositionRow = new Adw.ComboRow({
            title: 'Bar Position',
            model: Gtk.StringList.new(['left', 'center', 'right']),
        });
        this.getSettings().bind('bar-position', barPositionRow, 'selected',
            Gio.SettingsBindFlags.DEFAULT);
        group.add(barPositionRow);

        // Start Date
        const startDateRow = new Adw.EntryRow({
            title: 'Start Date (YYYY-MM-DD)',
        });
        this.getSettings().bind('start-date', startDateRow, 'text',
            Gio.SettingsBindFlags.DEFAULT);
        group.add(startDateRow);

        // End Date
        const endDateRow = new Adw.EntryRow({
            title: 'End Date (YYYY-MM-DD)',
        });
        this.getSettings().bind('end-date', endDateRow, 'text',
            Gio.SettingsBindFlags.DEFAULT);
        group.add(endDateRow);

        window.add(page);
    }
} 