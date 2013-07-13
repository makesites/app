module "app" {
	export class APP {

		name: 'APP()'
		// internal
		_routes: []

		constructor() {

		}

		routes() {
			return this._routes;
		}

	}
}