import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class DeadlineTimerPreferences extends ExtensionPreferences {
    constructor(metadata) {
        super(metadata);
    }

    fillPreferencesWindow(window) {
        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup();
        page.add(group);

        const barPositionRow = new Adw.ComboRow({
            title: 'Bar Position',
            model: Gtk.StringList.new(['left', 'center', 'right']),
        });
        
        const currentPosition = this.getSettings().get_string('bar-position');
        const positions = ['left', 'center', 'right'];
        const currentIndex = positions.indexOf(currentPosition);
        if (currentIndex !== -1) {
            barPositionRow.selected = currentIndex;
        }
        
        barPositionRow.connect('notify::selected', () => {
            const selectedIndex = barPositionRow.selected;
            if (selectedIndex >= 0 && selectedIndex < positions.length) {
                this.getSettings().set_string('bar-position', positions[selectedIndex]);
            }
        });
        
        group.add(barPositionRow);

        const startDateRow = new Adw.EntryRow({
            title: 'Start Date (DD-MM-YYYY)',
            show_apply_button: true,
        });
        group.add(startDateRow);

        const endDateRow = new Adw.EntryRow({
            title: 'End Date (DD-MM-YYYY)',
            show_apply_button: true,
        });
        group.add(endDateRow);

        const startDate = this.getSettings().get_string('start-date');
        const endDate = this.getSettings().get_string('end-date');

        if (startDate) {
            const [year, month, day] = startDate.split('-');
            startDateRow.text = `${day}-${month}-${year}`;
        }

        if (endDate) {
            const [year, month, day] = endDate.split('-');
            endDateRow.text = `${day}-${month}-${year}`;
        }

        const isValidDate = (dateStr) => {
            const regex = /^(\d{2})-(\d{2})-(\d{4})$/;
            if (!regex.test(dateStr)) return false;

            const [, day, month, year] = dateStr.match(regex);
            const date = new Date(year, month - 1, day);
            return date instanceof Date && !isNaN(date) &&
                   date.getDate() === parseInt(day) &&
                   date.getMonth() === parseInt(month) - 1 &&
                   date.getFullYear() === parseInt(year);
        };

        const convertToStorageFormat = (dateStr) => {
            const [day, month, year] = dateStr.split('-');
            return `${year}-${month}-${day}`;
        };

        startDateRow.connect('apply', () => {
            const dateStr = startDateRow.text;
            if (isValidDate(dateStr)) {
                const storageFormat = convertToStorageFormat(dateStr);
                this.getSettings().set_string('start-date', storageFormat);
            } else {
                startDateRow.add_css_class('error');
                setTimeout(() => startDateRow.remove_css_class('error'), 2000);
            }
        });

        endDateRow.connect('apply', () => {
            const dateStr = endDateRow.text;
            if (isValidDate(dateStr)) {
                const storageFormat = convertToStorageFormat(dateStr);
                this.getSettings().set_string('end-date', storageFormat);
            } else {
                endDateRow.add_css_class('error');
                setTimeout(() => endDateRow.remove_css_class('error'), 2000);
            }
        });

        window.add(page);
    }
} 