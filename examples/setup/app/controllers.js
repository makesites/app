import { APP, Controller } from "/build/app.js";

class Default extends Controller {

	constructor( options ) {
		super( options );

		console.log("controller init");
	}
}

// save in APP namespace
APP.Controllers.Default = Default;


export { Default };
