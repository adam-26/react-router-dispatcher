// @flow
import React from 'react';
import { connect } from 'react-redux';
import type { element } from 'prop-types';
import invariant from 'invariant';
import { REDUCER_NAME, STATIC_DISPATCHER_METHOD } from './utils';

type RouteComponent = (props:Object) => element | element;

const mapStateToProps = reducerName => state => ({
  isLoaded: state[reducerName].loaded,
  loadState: state[reducerName].loadState,
});

type AsyncRoutePropTypes = {
  route: Object,
  isLoaded: boolean,
  loadState: Object,
}

const routeHoc = (component, onLoad, onErr) => {
  const HOC = ({ route, isLoaded, loadState, ...rest }: AsyncRoutePropTypes) => {
    const { loading, error } = loadState[route.path] || {};
    const elementProps = { route, ...rest };
    if (error) {
      Object.assign(elementProps, { error });
      if (typeof onErr !== 'undefined') {
        return React.createElement(onErr, elementProps);
      }
    } else if ((!isLoaded || loading) && typeof onLoad !== 'undefined') {
      return React.createElement(onLoad, elementProps);
    }

    return React.createElement(component, elementProps);
  };

  // Expose the wrapped route components static dispatcher method
  HOC[STATIC_DISPATCHER_METHOD] = (store, match, helpers) =>
      component[STATIC_DISPATCHER_METHOD](store, match, helpers);

  return HOC;
};

/**
 * Utility method to create a HOC that will render either the route component,
 * a loading component or error component based on the current state.
 *
 * @param opts
 */
export default function routeContainer(
  opts?: {
    onLoad?: RouteComponent,
    onError?: RouteComponent,
    reducerName?: string } = {}): element {
  return (routeComponent: RouteComponent) => {
    invariant(routeComponent, '`routeContainer()` requires a Component.');

    return connect(mapStateToProps(opts.reducerName || REDUCER_NAME))(
        routeHoc(routeComponent, opts.onLoad, opts.onError)
    );
  };
}
