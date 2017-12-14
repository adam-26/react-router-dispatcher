import React from 'react';
import PropTypes from 'prop-types';
import { matchRoutes } from 'react-router-config';
import withActions from '../withActions';
import {
    dispatchRouteActions,
    dispatchServerActions,
    dispatchClientActions,
    resolveActionSets,
    resolveRouteComponents,
    reduceActionSets
} from '../dispatchRouteActions';

let order = [];
let orderedParams = [];
const appendOrder = (id) => order.push(id);
const appendParams = (routeParams, params, routeCtx) => orderedParams.push([routeParams, params, routeCtx]);

const LOAD_DATA = 'loadData';
const PARSE_DATA = 'parseData';

function initRoutes(opts = {}) {
    const {
        mockInitServerAction,
        mockLoadDataMapToProps,
        mockInitClientAction,
        mockParseDataMapToProps,
        mockRootAction,
        mockHomeAction
    } = Object.assign({
        mockInitServerAction: jest.fn(p => p),
        mockLoadDataMapToProps: jest.fn(p => p),
        mockInitClientAction: jest.fn(p => p),
        mockParseDataMapToProps: jest.fn(p => p),
        mockRootAction: jest.fn((routeParams, actionParams, routerCtx) => {
            appendOrder(0); appendParams(routeParams, actionParams, routerCtx);
        }),
        mockHomeAction: jest.fn((routeParams, actionParams, routerCtx) => {
            appendOrder(1); appendParams(routeParams, actionParams, routerCtx);
        })
    }, opts);

    function loadDataAction() {
        return {
            name: LOAD_DATA,
            staticMethodName: 'primary',
            initServerAction: mockInitServerAction,
            mapParamsToProps: mockLoadDataMapToProps
        };
    }

    function parseDataAction() {
        return {
            name: PARSE_DATA,
            staticMethodName: 'secondary',
            initClientAction: mockInitClientAction,
            mapParamsToProps: mockParseDataMapToProps
        };
    }

    let Root = ({children}) => <div>{children}</div>;
    Root.propTypes = {children: PropTypes.any};
    Root.primary = mockRootAction;
    Root = withActions(loadDataAction())(Root);

    let Home = () => <p>Hello World</p>;
    Home.secondary = mockHomeAction;
    Home = withActions(parseDataAction())(Home);

    const routes = [
        { component: Root,
            routes: [
                { path: '/',
                    exact: true,
                    component: Home
                }
            ]
        }
    ];

    return {
        Home,
        Root,
        routes,
        mocks: {
            mockInitServerAction,
            mockLoadDataMapToProps,
            mockInitClientAction,
            mockParseDataMapToProps,
            mockRootAction,
            mockHomeAction
        }
    };
}

describe('dispatchRouteActions', () => {

    const actions = [[LOAD_DATA, PARSE_DATA]];
    const routeComponentPropNames = ['component'];
    const actionParams = {};
    let location;
    let routes, Home, Root, mocks;

    beforeEach(() => {
        order = []; // reset
        orderedParams = [];

        const init = initRoutes();
        routes = init.routes;
        mocks = init.mocks;
        Home = init.Home;
        Root = init.Root;
        location = '/';
    });

    describe('dispatchRouteActions', () => {
        test('resolveRouteComponents', () => {
            const branch = matchRoutes(routes, location);
            const resolved = resolveRouteComponents(branch, routeComponentPropNames);

            expect(resolved).toHaveLength(2);
            expect(resolved[0][0]).toEqual(Root);
            expect(resolved[1][0]).toEqual(Home);
        });

        test('resolveActionSets - flat', () => {
            const match0 = {match: '0'};
            const match1 = {match: '1'};

            const routeComponents = [
                [Root, match0],
                [Home, match1]
            ];

            const actionSets = resolveActionSets(routeComponents, actions);

            expect(actionSets).toHaveLength(1);
            expect(actionSets[0]).toHaveLength(2);

            expect(actionSets[0][0][0]).toEqual(Root.primary);
            expect(actionSets[0][0][3]).toEqual(match0);

            expect(actionSets[0][1][0]).toEqual(Home.secondary);
            expect(actionSets[0][1][3]).toEqual(match1);
        });

        test('resolveActionSets - serial', () => {
            const match0 = {match: '0'};
            const match1 = {match: '1'};

            const routeComponents = [
                [Root, match0],
                [Home, match1]
            ];

            const actionSets = resolveActionSets(routeComponents, [[LOAD_DATA], [PARSE_DATA]]);
            expect(actionSets).toHaveLength(2);

            expect(actionSets[0]).toHaveLength(1);
            expect(actionSets[0][0][0]).toEqual(Root.primary);
            expect(actionSets[0][0][3]).toEqual(match0);

            expect(actionSets[1]).toHaveLength(1);
            expect(actionSets[1][0][0]).toEqual(Home.secondary);
            expect(actionSets[1][0][3]).toEqual(match1);
        });

        test('reduceActionSets - parallel', done => {

            jest.setTimeout(2500);

            const mocks = [
                jest.fn(() => appendOrder(0)),
                jest.fn(() => appendOrder(1)),
                jest.fn(() => appendOrder(2))
            ];

            const mockMapFns = [
                jest.fn((params) => params),
                jest.fn((params) => params),
                jest.fn((params) => params)
            ];

            const mockInitFns = [
                jest.fn((params) => params),
                jest.fn((params) => params),
                jest.fn((params) => params)
            ];

            let inputParams = { hello: 'world' };
            const match = {match: '0'};
            const location = { pathname: '/' };
            const reduced = reduceActionSets([[
                [(m, h) => new Promise(resolve => { setTimeout(() => { mocks[0](m, h); resolve(); }, 300) }), mockMapFns[0], mockInitFns[0], match],
                [(m, h) => new Promise(resolve => { setTimeout(() => { mocks[1](m, h); resolve(); }, 200) }), mockMapFns[1], mockInitFns[1], match],
                [(m, h) => new Promise(resolve => { setTimeout(() => { mocks[2](m, h); resolve(); }, 100) }), mockMapFns[2], mockInitFns[2], match]
            ]], location, inputParams);

            reduced.then((outputParams) => {
                // verify output
                expect(outputParams).toEqual(inputParams);

                // verify mocks
                expect(mocks[0].mock.calls).toHaveLength(1);
                expect(mocks[0].mock.calls[0][0]).toEqual({ location, match });
                expect(mocks[0].mock.calls[0][1]).toEqual(inputParams);

                expect(mockMapFns[0].mock.calls).toHaveLength(1);
                expect(mockMapFns[0].mock.calls[0][0]).toEqual(inputParams);

                expect(mockInitFns[0].mock.calls).toHaveLength(1);
                expect(mockInitFns[0].mock.calls[0][0]).toEqual(inputParams);

                expect(mocks[1].mock.calls).toHaveLength(1);
                expect(mocks[1].mock.calls[0][0]).toEqual({ location, match });
                expect(mocks[1].mock.calls[0][1]).toEqual(inputParams);

                expect(mockMapFns[1].mock.calls).toHaveLength(1);
                expect(mockMapFns[1].mock.calls[0][0]).toEqual(inputParams);

                expect(mockInitFns[1].mock.calls).toHaveLength(1);
                expect(mockInitFns[1].mock.calls[0][0]).toEqual(inputParams);

                expect(mocks[2].mock.calls).toHaveLength(1);
                expect(mocks[2].mock.calls[0][0]).toEqual({ location, match });
                expect(mocks[2].mock.calls[0][1]).toEqual(inputParams);

                expect(mockMapFns[2].mock.calls).toHaveLength(1);
                expect(mockMapFns[2].mock.calls[0][0]).toEqual(inputParams);

                expect(mockInitFns[2].mock.calls).toHaveLength(1);
                expect(mockInitFns[2].mock.calls[0][0]).toEqual(inputParams);

                // verify order
                expect(order).toEqual([2,1,0]);
                done();
            });
        });

        test('reduceActionSets - serial', done => {

            jest.setTimeout(2500);

            const mockActionFns = [
                jest.fn(() => appendOrder(0)),
                jest.fn(() => appendOrder(1)),
                jest.fn(() => appendOrder(2))
            ];

            const mockMapFns = [
                jest.fn((params) => params),
                jest.fn((params) => params),
                jest.fn((params) => params)
            ];

            const mockInitFns = [
                jest.fn((params) => params),
                jest.fn((params) => params),
                jest.fn((params) => params)
            ];

            let inputParams = { hello: 'world' };
            const match = {match: '0'};
            const location = { pathname: '/' };
            const reduced = reduceActionSets([
                [[(m, h) => new Promise(resolve => { setTimeout(() => { mockActionFns[0](m, h); resolve(); }, 300) }), mockMapFns[0], mockInitFns[0], match]],
                [[(m, h) => new Promise(resolve => { setTimeout(() => { mockActionFns[1](m, h); resolve(); }, 200) }), mockMapFns[1], mockInitFns[1], match]],
                [[(m, h) => new Promise(resolve => { setTimeout(() => { mockActionFns[2](m, h); resolve(); }, 100) }), mockMapFns[2], mockInitFns[2], match]]
            ], location, inputParams);

            reduced.then((outputParams) => {
                // verify output
                expect(outputParams).toEqual(inputParams);

                // verify mocks
                expect(mockActionFns[0].mock.calls).toHaveLength(1);
                expect(mockActionFns[0].mock.calls[0][0]).toEqual({ location, match });
                expect(mockActionFns[0].mock.calls[0][1]).toEqual(inputParams);

                expect(mockMapFns[0].mock.calls).toHaveLength(1);
                expect(mockMapFns[0].mock.calls[0][0]).toEqual(inputParams);

                expect(mockInitFns[0].mock.calls).toHaveLength(1);
                expect(mockInitFns[0].mock.calls[0][0]).toEqual(inputParams);

                expect(mockActionFns[1].mock.calls).toHaveLength(1);
                expect(mockActionFns[1].mock.calls[0][0]).toEqual({ location, match });
                expect(mockActionFns[1].mock.calls[0][1]).toEqual(inputParams);

                expect(mockMapFns[1].mock.calls).toHaveLength(1);
                expect(mockMapFns[1].mock.calls[0][0]).toEqual(inputParams);

                expect(mockInitFns[1].mock.calls).toHaveLength(1);
                expect(mockInitFns[1].mock.calls[0][0]).toEqual(inputParams);

                expect(mockActionFns[2].mock.calls).toHaveLength(1);
                expect(mockActionFns[2].mock.calls[0][0]).toEqual({ location, match });
                expect(mockActionFns[2].mock.calls[0][1]).toEqual(inputParams);

                expect(mockMapFns[2].mock.calls).toHaveLength(1);
                expect(mockMapFns[2].mock.calls[0][0]).toEqual(inputParams);

                expect(mockInitFns[2].mock.calls).toHaveLength(1);
                expect(mockInitFns[2].mock.calls[0][0]).toEqual(inputParams);

                // verify order
                expect(order).toEqual([0,1,2]);
                done();
            });
        });

        test('returns promise when no routes matched', done => {
            const { mockHomeAction, mockRootAction } = mocks;
            const p = dispatchRouteActions(
                { pathname: '/helloworld' },
                actions,
                { routes: [], routeComponentPropNames },
                actionParams);

            p.then(() => {
                expect(mockHomeAction.mock.calls).toHaveLength(0);
                expect(mockRootAction.mock.calls).toHaveLength(0);
                done();
            });
        });

        test('returns promise when routes matched - dispatchAction function', done => {
            const { mockHomeAction, mockRootAction } = mocks;
            const p = dispatchRouteActions(
                { pathname: '/' },
                () => [[LOAD_DATA, PARSE_DATA]],
                { routes, routeComponentPropNames },
                actionParams);

            p.then(() => {
                expect(mockHomeAction.mock.calls).toHaveLength(1);
                expect(mockRootAction.mock.calls).toHaveLength(1);
                expect(order).toEqual([0, 1]);

                // verify match params
                expect(orderedParams[0][0].location).toBeDefined();
                expect(orderedParams[0][0].match).toBeDefined();

                // verify action params
                expect(orderedParams[0][1]).toEqual(actionParams);

                // verify route params
                expect(orderedParams[0][2].route).toBeDefined();
                expect(orderedParams[0][2].routeComponentKey).toBeDefined();
                done();
            });
        });

        test('returns promise when routes matched - flat', done => {
            const { mockHomeAction, mockRootAction } = mocks;
            const p = dispatchRouteActions(
                { pathname: '/' },
                actions,
                { routes, routeComponentPropNames },
                actionParams);

            p.then(() => {
                expect(mockHomeAction.mock.calls).toHaveLength(1);
                expect(mockRootAction.mock.calls).toHaveLength(1);
                expect(order).toEqual([0, 1]);
                done();
            });
        });

        test('returns promise when routes matched - serial', done => {
            const { mockHomeAction, mockRootAction } = mocks;
            const p = dispatchRouteActions(
                { pathname: '/' },
                [[LOAD_DATA], [PARSE_DATA]],
                { routes, routeComponentPropNames },
                actionParams);

            p.then(() => {
                expect(mockHomeAction.mock.calls).toHaveLength(1);
                expect(mockRootAction.mock.calls).toHaveLength(1);
                expect(order).toEqual([0, 1]);
                done();
            });
        });

        test('dispatchServerActions does not invoke client actions', done => {
            const {
                mockHomeAction,
                mockRootAction,
                mockInitServerAction,
                mockLoadDataMapToProps,
                mockInitClientAction,
                mockParseDataMapToProps
            } = mocks;

            // TODO: Add other test the ensure logic REMOVES any EMPTY actionSet(s) from processing...

            const p = dispatchServerActions(
                { pathname: '/' },
                [[LOAD_DATA], [PARSE_DATA]],
                { routes, routeComponentPropNames },
                actionParams);

            p.then(() => {
                expect(mockRootAction.mock.calls).toHaveLength(1);
                expect(mockHomeAction.mock.calls).toHaveLength(0);
                expect(order).toEqual([0]);

                // Verify action mocks
                expect(mockInitServerAction.mock.calls).toHaveLength(1);
                expect(mockLoadDataMapToProps.mock.calls).toHaveLength(1);
                expect(mockInitClientAction.mock.calls).toHaveLength(0);
                expect(mockParseDataMapToProps.mock.calls).toHaveLength(0);

                done();
            });
        });

        test('dispatchClientActions does not invoke server actions', () => {

            // Custom init for client dispatcher tests
            const { routes, mocks } = initRoutes({
                mockInitClientAction: jest.fn(p => ({ ...p, clientData: {} })),
                mockHomeAction: jest.fn((routeParams, actionParams/*, routerCtx*/) => {
                    actionParams.clientData.value = 1
                })
            });
            const {
                mockHomeAction,
                mockRootAction,
                mockInitServerAction,
                mockLoadDataMapToProps,
                mockInitClientAction,
                mockParseDataMapToProps
            } = mocks;

            const props = dispatchClientActions(
                { pathname: '/' },
                [[LOAD_DATA], [PARSE_DATA]],
                { routes, routeComponentPropNames },
                actionParams);

            expect(mockRootAction.mock.calls).toHaveLength(0);
            expect(mockHomeAction.mock.calls).toHaveLength(1);

            // Verify action mocks
            expect(mockInitClientAction.mock.calls).toHaveLength(1);
            expect(mockParseDataMapToProps.mock.calls).toHaveLength(1);
            expect(mockInitServerAction.mock.calls).toHaveLength(0);
            expect(mockLoadDataMapToProps.mock.calls).toHaveLength(0);

            expect(props).toEqual({ clientData: { value: 1 } });
        });
    });
});
