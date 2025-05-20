
declare module 'spacy' {

    export function load(model: string): Promise<Language>;



    export interface Language {

        (text: string): Doc;

    }



    export interface Doc {

        ents: Entity[];

    }



    export interface Entity {

        text: string;

        label_: string;

    }

}
