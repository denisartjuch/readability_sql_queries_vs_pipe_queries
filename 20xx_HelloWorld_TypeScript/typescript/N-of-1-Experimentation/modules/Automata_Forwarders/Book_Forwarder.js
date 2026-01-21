import { from } from "../Automata/Transitions.js";
import { Automata_Configurator } from "../Automata/Automata_Configurator.js";
import { Automata_With_Output_Forwarder } from "./Automata_With_Output_Forwarder.js";
export function init() { }
let SHOW_PAGE = 0;
let FINISHED_BOOK = 1;
let EVERYTHING_DONE = 1;
export class Book_Forwarder extends Automata_With_Output_Forwarder {
    constructor(book_name, text, measurement) {
        super(book_name, measurement, text[0], text[text.length - 1]);
        this.current_page_number = -1;
        this.pages = text;
        this.create_automata();
    }
    set_page_index(index) {
        this.current_page_number = index;
        this.empty_screen_and_show_instructions(this.pages[this.current_page_number]);
        this.output_writer().print_string_to_state(this.forwarder_name);
        this.output_writer().print_string_to_page_number("Page " + (this.current_page_number + 1) + " / " + this.pages.length);
        let navigation_string = "<hr>";
        if (index > 0)
            navigation_string += "[&#8592] = previous page";
        if (index < this.pages.length - 1)
            navigation_string += (navigation_string != "<hr>" ? "<br>" : "") + "[&#8594] = next page";
        if (index == this.pages.length - 1)
            navigation_string += (navigation_string != "<hr>" ? "<br>" : "") + "[Enter] = Finish";
        this.output_writer().print_html_on_stage(navigation_string);
    }
    set_active() {
        super.set_active();
    }
    show_intro() {
        this.set_page_index(0);
    }
    show_outro() { }
    automata_configurator() {
        return new Automata_Configurator([SHOW_PAGE, EVERYTHING_DONE], SHOW_PAGE, () => { }, this.transitions(), [EVERYTHING_DONE]);
    }
    transitions() {
        return [
            from(SHOW_PAGE).to(SHOW_PAGE)
                .on("ArrowRight")
                .if((i) => this.current_page_number < this.pages.length - 1)
                .do((i) => {
                this.set_page_index(++this.current_page_number);
            }),
            from(SHOW_PAGE).to(SHOW_PAGE)
                .on("ArrowLeft")
                .if((i) => this.current_page_number > 0)
                .do((i) => {
                this.set_page_index(--this.current_page_number);
            }),
            from(SHOW_PAGE).to(EVERYTHING_DONE)
                .on("Enter")
                .if((i) => this.current_page_number >= this.pages.length - 1)
                .do((i) => { })
        ];
    }
}
