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
    reduceActionSets,
    dispatchComponentActions,
    parseDispatchActions
} from '../dispatchRouteActions';

let order = [];
let orderedParams = [];
const appendOrder = (id) => order.push(id);
const appendParams = (props, routeCtx) => orderedParams.push([props, routeCtx]);

const LOAD_DATA = 'loadData';
const PARSE_DATA = 'parseData';

const defaultActionParams = {
    httpResponse: {
        statusCode: 200
    }
};

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
        mockRootAction: jest.fn((actionProps, routerCtx) => {
            appendOrder(0); appendParams(actionProps, routerCtx);
        }),
        mockHomeAction: jest.fn((actionProps, routerCtx) => {
            appendOrder(1); appendParams(actionProps, routerCtx);
        })
    }, opts);

    function loadDataAction() {
        return {
            name: LOAD_DATA,
            staticMethodName: 'primary',
            initServerAction: mockInitServerAction,
            filterParamsToProps: mockLoadDataMapToProps
        };
    }

    function parseDataAction() {
        return {
            name: PARSE_DATA,
            staticMethodName: 'secondary',
            initClientAction: mockInitClientAction,
            filterParamsToProps: mockParseDataMapToProps
        };
    }

    let Root = ({children}) => <div>{children}</div>;
    Root.propTypes = {children: PropTypes.any};
    Root.primary = mockRootAction;
    Root = withActions(null, loadDataAction())(Root);

    let Home = () => <p>Hello World</p>;
    Home.secondary = mockHomeAction;
    Home = withActions(null, parseDataAction())(Home);

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

            expect(actionSets).toHaveLength(2);
            expect(actionSets[0].routeActions).toHaveLength(1);
            expect(actionSets[1].routeActions).toHaveLength(1);

            expect(actionSets[0].routeActions[0][0]).toEqual(Root.primary);
            expect(actionSets[0].routeActions[0][1]).toEqual(match0);

            expect(actionSets[1].routeActions[0][0]).toEqual(Home.secondary);
            expect(actionSets[1].routeActions[0][1]).toEqual(match1);
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

            expect(actionSets[0].routeActions).toHaveLength(1);
            expect(actionSets[0].routeActions[0][0]).toEqual(Root.primary);
            expect(actionSets[0].routeActions[0][1]).toEqual(match0);

            expect(actionSets[1].routeActions).toHaveLength(1);
            expect(actionSets[1].routeActions[0][0]).toEqual(Home.secondary);
            expect(actionSets[1].routeActions[0][1]).toEqual(match1);
        });

        test('reduceActionSets - parallel', done => {

            jest.setTimeout(2500);

            const mocks = [
                jest.fn(() => appendOrder(0)),
                jest.fn(() => appendOrder(1)),
                jest.fn(() => appendOrder(2))
            ];

            const mockFilterFn = jest.fn((params) => params);
            const mockInitFn = jest.fn((params) => params);

            const mockMapFns = [
                jest.fn((params) => params),
                jest.fn((params) => params),
                jest.fn((params) => params)
            ];

            let inputParams = { hello: 'world' };
            const match = {match: '0'};
            const location = { pathname: '/' };
            const routerCtx = {};
            const reduced = reduceActionSets([{
                initParams: mockInitFn,
                filterParams: mockFilterFn,
                actionErrorHandler: e => { throw e; },
                actionSuccessHandler: () => null,
                stopServerActions: () => false,
                routeActions: [
                    // TODO: Add MAP FNs
                    [(m, h) => new Promise(resolve => { setTimeout(() => { mocks[0](m, h); resolve(); }, 300) }), match, routerCtx, mockMapFns[0]],
                    [(m, h) => new Promise(resolve => { setTimeout(() => { mocks[1](m, h); resolve(); }, 200) }), match, routerCtx, mockMapFns[1]],
                    [(m, h) => new Promise(resolve => { setTimeout(() => { mocks[2](m, h); resolve(); }, 100) }), match, routerCtx, mockMapFns[2]]
                ]
            }], location, inputParams);

            reduced.then((outputParams) => {
                // verify output
                expect(outputParams).toEqual(defaultActionParams);

                // verify mocks
                expect(mockFilterFn.mock.calls).toHaveLength(1);
                expect(mockFilterFn.mock.calls[0][0]).toEqual(defaultActionParams);

                expect(mockInitFn.mock.calls).toHaveLength(1);
                expect(mockInitFn.mock.calls[0][0]).toEqual(defaultActionParams);

                expect(mocks[0].mock.calls).toHaveLength(1);
                expect(mocks[0].mock.calls[0][0]).toEqual({ ...defaultActionParams, ...inputParams, location, match });

                expect(mockMapFns[0].mock.calls).toHaveLength(1);
                expect(mockMapFns[0].mock.calls[0][0]).toEqual(inputParams);

                expect(mockMapFns[1].mock.calls).toHaveLength(1);
                expect(mockMapFns[1].mock.calls[0][0]).toEqual(inputParams);

                expect(mocks[1].mock.calls).toHaveLength(1);
                expect(mocks[1].mock.calls[0][0]).toEqual({ ...defaultActionParams, ...inputParams, location, match });

                expect(mockMapFns[2].mock.calls).toHaveLength(1);
                expect(mockMapFns[2].mock.calls[0][0]).toEqual(inputParams);

                expect(mocks[2].mock.calls).toHaveLength(1);
                expect(mocks[2].mock.calls[0][0]).toEqual({ ...defaultActionParams, ...inputParams, location, match });

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

            const mockFilterFns = [
                jest.fn((params) => params),
                jest.fn((params) => params),
                jest.fn((params) => params)
            ];

            const mockInitFns = [
                jest.fn((params) => params),
                jest.fn((params) => params),
                jest.fn((params) => params)
            ];

            const mockMapFns = [
                jest.fn((params) => params),
                jest.fn((params) => params),
                jest.fn((params) => params)
            ];

            let inputParams = { hello: 'world' };
            const match = {match: '0'};
            const location = { pathname: '/' };
            const routerCtx = {};
            const reduced = reduceActionSets([{
                initParams: mockInitFns[0],
                filterParams: mockFilterFns[0],
                actionErrorHandler: e => { throw e; },
                actionSuccessHandler: () => null,
                stopServerActions: () => false,
                routeActions: [
                    [(m, h) => new Promise(resolve => { setTimeout(() => { mockActionFns[0](m, h); resolve(); }, 300) }), match, routerCtx, mockMapFns[0]]
                ]
            }, {
                initParams: mockInitFns[1],
                filterParams: mockFilterFns[1],
                actionErrorHandler: e => { throw e; },
                actionSuccessHandler: () => null,
                stopServerActions: () => false,
                routeActions: [
                    [(m, h) => new Promise(resolve => { setTimeout(() => { mockActionFns[1](m, h); resolve(); }, 200) }), match, routerCtx, mockMapFns[1]]
                ]
            }, {
                initParams: mockInitFns[2],
                filterParams: mockFilterFns[2],
                actionErrorHandler: e => { throw e; },
                actionSuccessHandler: () => null,
                stopServerActions: () => false,
                routeActions: [
                    [(m, h) => new Promise(resolve => { setTimeout(() => { mockActionFns[2](m, h); resolve(); }, 100) }), match, routerCtx, mockMapFns[2]]
                ]
            }], location, inputParams);

            reduced.then((outputParams) => {
                // verify output
                expect(outputParams).toEqual(defaultActionParams);

                // verify mocks
                expect(mockActionFns[0].mock.calls).toHaveLength(1);
                expect(mockActionFns[0].mock.calls[0][0]).toEqual({ ...defaultActionParams, ...inputParams, location, match });

                expect(mockFilterFns[0].mock.calls).toHaveLength(1);
                expect(mockFilterFns[0].mock.calls[0][0]).toEqual(defaultActionParams);

                expect(mockInitFns[0].mock.calls).toHaveLength(1);
                expect(mockInitFns[0].mock.calls[0][0]).toEqual(defaultActionParams);

                expect(mockMapFns[0].mock.calls).toHaveLength(1);
                expect(mockMapFns[0].mock.calls[0][0]).toEqual(inputParams);

                expect(mockActionFns[1].mock.calls).toHaveLength(1);
                expect(mockActionFns[1].mock.calls[0][0]).toEqual({ ...defaultActionParams, ...inputParams, location, match });

                expect(mockFilterFns[1].mock.calls).toHaveLength(1);
                expect(mockFilterFns[1].mock.calls[0][0]).toEqual(defaultActionParams);

                expect(mockInitFns[1].mock.calls).toHaveLength(1);
                expect(mockInitFns[1].mock.calls[0][0]).toEqual(defaultActionParams);

                expect(mockMapFns[1].mock.calls).toHaveLength(1);
                expect(mockMapFns[1].mock.calls[0][0]).toEqual(inputParams);

                expect(mockActionFns[2].mock.calls).toHaveLength(1);
                expect(mockActionFns[2].mock.calls[0][0]).toEqual({ ...defaultActionParams, ...inputParams, location, match });

                expect(mockFilterFns[2].mock.calls).toHaveLength(1);
                expect(mockFilterFns[2].mock.calls[0][0]).toEqual(defaultActionParams);

                expect(mockInitFns[2].mock.calls).toHaveLength(1);
                expect(mockInitFns[2].mock.calls[0][0]).toEqual(defaultActionParams);

                expect(mockMapFns[2].mock.calls).toHaveLength(1);
                expect(mockMapFns[2].mock.calls[0][0]).toEqual(inputParams);

                // verify order
                expect(order).toEqual([0,1,2]);
                done();
            });
        });

        test('reduceActionSets - serial with stopServerAction should prevent action invocations', done => {

            jest.setTimeout(2500);

            const mockActionFns = [
                jest.fn(() => appendOrder(0)),
                jest.fn(() => appendOrder(1)),
                jest.fn(() => appendOrder(2))
            ];

            const mockInitFns = [
                jest.fn((params) => params),
                jest.fn((params) => params),
                jest.fn((params) => params)
            ];

            const mockFilterFns = [
                jest.fn((params) => params),
                jest.fn((params) => params),
                jest.fn((params) => params)
            ];

            const mockMapFns = [
                jest.fn((params) => params),
                jest.fn((params) => params),
                jest.fn((params) => params)
            ];

            const mockStopServerActions = jest.fn();
            let inputParams = { hello: 'world' };
            const match = {match: '0'};
            const location = { pathname: '/' };
            const routerCtx = {};
            const reduced = reduceActionSets([{
                initParams: mockInitFns[0],
                filterParams: mockFilterFns[0],
                actionErrorHandler: e => { throw e; },
                actionSuccessHandler: () => null,
                stopServerActions: () => false,
                routeActions: [
                    [(m, h) => new Promise(resolve => { setTimeout(() => { mockActionFns[0](m, h); resolve(); }, 300) }), match, routerCtx, mockMapFns[0]]
                ]
            }, {
                initParams: mockInitFns[1],
                filterParams: mockFilterFns[1],
                actionErrorHandler: e => { throw e; },
                actionSuccessHandler: () => null,
                stopServerActions: () => true,
                routeActions: [
                    [(m, h) => new Promise(resolve => { setTimeout(() => { mockActionFns[1](m, h); resolve(); }, 200) }), match, routerCtx, mockMapFns[1]]
                ]
            }, {
                initParams: mockInitFns[2],
                filterParams: mockFilterFns[2],
                actionErrorHandler: e => { throw e; },
                actionSuccessHandler: () => null,
                stopServerActions: mockStopServerActions,
                routeActions: [
                    [(m, h) => new Promise(resolve => { setTimeout(() => { mockActionFns[2](m, h); resolve(); }, 100) }), match, routerCtx, mockMapFns[2]]
                ]
            }], location, inputParams);

            reduced.then((outputParams) => {
                // verify output
                expect(outputParams).toEqual(defaultActionParams);

                // verify mocks
                expect(mockActionFns[0].mock.calls).toHaveLength(1);
                expect(mockActionFns[0].mock.calls[0][0]).toEqual({ ...defaultActionParams, ...inputParams, location, match });

                expect(mockFilterFns[0].mock.calls).toHaveLength(1);
                expect(mockFilterFns[0].mock.calls[0][0]).toEqual(defaultActionParams);

                expect(mockInitFns[0].mock.calls).toHaveLength(1);
                expect(mockInitFns[0].mock.calls[0][0]).toEqual(defaultActionParams);

                expect(mockMapFns[0].mock.calls).toHaveLength(1);

                expect(mockActionFns[1].mock.calls).toHaveLength(1);
                expect(mockActionFns[1].mock.calls[0][0]).toEqual({ ...defaultActionParams, ...inputParams, location, match });

                expect(mockFilterFns[1].mock.calls).toHaveLength(1);
                expect(mockFilterFns[1].mock.calls[0][0]).toEqual(defaultActionParams);

                expect(mockInitFns[1].mock.calls).toHaveLength(1);
                expect(mockInitFns[1].mock.calls[0][0]).toEqual(defaultActionParams);

                expect(mockMapFns[1].mock.calls).toHaveLength(1);

                // The last actionSet should NOT be invoked
                expect(mockActionFns[2].mock.calls).toHaveLength(0);
                expect(mockInitFns[2].mock.calls).toHaveLength(0);
                expect(mockFilterFns[2].mock.calls).toHaveLength(0);
                expect(mockMapFns[2].mock.calls).toHaveLength(0);

                expect(mockStopServerActions.mock.calls).toHaveLength(0);

                // verify order
                expect(order).toEqual([0,1]);
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

                // verify props
                expect(orderedParams[0][0].location).toBeDefined();
                expect(orderedParams[0][0].match).toBeDefined();
                expect(orderedParams[0][0].httpResponse).toBeDefined();

                // verify route params
                expect(orderedParams[0][1].route).toBeDefined();
                expect(orderedParams[0][1].routeComponentKey).toBeDefined();
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

        test('dispatchComponentActions does not invoke mapper or init functions', done => {
            const {
                mockHomeAction,
                mockRootAction,
                mockInitServerAction,
                mockLoadDataMapToProps,
                mockInitClientAction,
                mockParseDataMapToProps
            } = mocks;

            const p = dispatchComponentActions(
                { pathname: '/' },
                [[LOAD_DATA], [PARSE_DATA]],
                { routes, routeComponentPropNames },
                actionParams);

            p.then(() => {
                expect(mockRootAction.mock.calls).toHaveLength(1);
                expect(mockHomeAction.mock.calls).toHaveLength(1);
                expect(order).toEqual([0, 1]);

                // Verify action mocks
                expect(mockInitServerAction.mock.calls).toHaveLength(0);
                expect(mockLoadDataMapToProps.mock.calls).toHaveLength(0);
                expect(mockInitClientAction.mock.calls).toHaveLength(0);
                expect(mockParseDataMapToProps.mock.calls).toHaveLength(0);

                done();
            });
        });

        test('dispatchClientActions does not invoke server actions', () => {

            // Custom init for client dispatcher tests
            const { routes, mocks } = initRoutes({
                mockInitClientAction: jest.fn(p => ({ ...p, clientData: {} })),
                mockHomeAction: jest.fn((actionParams/*, routerCtx*/) => {
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

            expect(props).toEqual({ clientData: { value: 1 }, httpResponse: { statusCode: 200 } });
        });
    });

    describe('parseDispatchActions', () => {
        test('convert single action to action set', () => {
            expect(parseDispatchActions('redir')).toEqual([['redir']]);
        });

        test('convert single action array to action set', () => {
            expect(parseDispatchActions(['redir'])).toEqual([['redir']]);
        });

        test('convert multiple action array to action set', () => {
            expect(parseDispatchActions(['redir', 'status'])).toEqual([['redir', 'status']]);
        });

        test('returns single action set as action set', () => {
            expect(parseDispatchActions([['redir']])).toEqual([['redir']]);
        });

        test('returns action set', () => {
            expect(parseDispatchActions([['redir', 'status']])).toEqual([['redir', 'status']]);
        });

        test('converts combination of actions to action sets (1a)', () => {
            expect(parseDispatchActions([
                'first',
                ['second'],
                ['third', 'fourth']
            ])).toEqual([
                ['first'],
                ['second'],
                ['third', 'fourth']
            ]);
        });

        test('converts combination of actions to action sets (2a)', () => {
            expect(parseDispatchActions([
                ['first', 'second'],
                'third',
                ['fourth']
            ])).toEqual([
                ['first', 'second'],
                ['third'],
                ['fourth']
            ]);
        });

        test('converts combination of actions to action sets (3a)', () => {
            expect(parseDispatchActions([
                ['first', 'second'],
                ['third'],
                'fourth'
            ])).toEqual([
                ['first', 'second'],
                ['third'],
                ['fourth']
            ]);
        });

        test('converts combination of actions to action sets (4a)', () => {
            expect(parseDispatchActions([
                ['first'],
                ['second', 'third'],
                'fourth'
            ])).toEqual([
                ['first'],
                ['second', 'third'],
                ['fourth']
            ]);
        });
    });
});
