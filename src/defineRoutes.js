// @flow

/**
 * Define react-router-config routes, and assigns a key to each route.
 *
 * @param routes
 * @param idx
 * @returns {Array} Routes with a key value assigned to each route
 */
export default function defineRoutes(routes: Array<Object>, idx?: number = 0) {
    routes.forEach(route => {
       route.key = typeof route.key !== 'undefined' ? route.key : idx++;
       if (Array.isArray(route.routes)) {
           defineRoutes(route.routes, idx);
       }
    });

    return routes;
}
