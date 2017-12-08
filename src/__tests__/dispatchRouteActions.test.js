import React from 'react';
import PropTypes from 'prop-types';
import { matchRoutes } from 'react-router-config';
import dispatchRouteActions, {resolveActionSets, resolveRouteComponents, reduceActionSets} from '../dispatchRouteActions';

let mockRootAction;
let mockHomeAction;

const Root = ({ children }) => <div>{children}</div>;
Root.propTypes = { children: PropTypes.any };
const Home = () => <p>Hello World</p>;

describe('dispatchRouteActions', () => {
    let order = [];
    let actionParams = [];
    const appendOrder = (id) => order.push(id);
    const appendParams = (match, params, routeParams) => actionParams.push([match, params, routeParams]);

    const dispatchActions = [['primary', 'secondary']];
    const routeComponentPropNames = ['component'];
    const actionParams = {};
    let location;
    let routes;

    beforeEach(() => {
        order = []; // reset
        actionParams = [];

        Root.primary = mockRootAction = jest.fn((match, params, routeParams) => { appendOrder(0); appendParams(match, params, routeParams) });
        Home.secondary = mockHomeAction = jest.fn((match, params, routeParams) => { appendOrder(1); appendParams(match, params, routeParams) });

        routes = [
            { component: Root,
                routes: [
                    { path: '/',
                        exact: true,
                        component: Home
                    }
                ]
            }
        ];
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

            const actionSets = resolveActionSets(routeComponents, dispatchActions);

            expect(actionSets).toHaveLength(1);
            expect(actionSets[0]).toHaveLength(2);

            expect(actionSets[0][0][0]).toEqual(Root.primary);
            expect(actionSets[0][0][1]).toEqual(match0);

            expect(actionSets[0][1][0]).toEqual(Home.secondary);
            expect(actionSets[0][1][1]).toEqual(match1);
        });

        test('resolveActionSets - serial', () => {
            const match0 = {match: '0'};
            const match1 = {match: '1'};

            const routeComponents = [
                [Root, match0],
                [Home, match1]
            ];

            const actionSets = resolveActionSets(routeComponents, [['primary'], ['secondary']]);
            expect(actionSets).toHaveLength(2);

            expect(actionSets[0]).toHaveLength(1);
            expect(actionSets[0][0][0]).toEqual(Root.primary);
            expect(actionSets[0][0][1]).toEqual(match0);

            expect(actionSets[1]).toHaveLength(1);
            expect(actionSets[1][0][0]).toEqual(Home.secondary);
            expect(actionSets[1][0][1]).toEqual(match1);
        });

        test('reduceActionSets - parallel', done => {

            jest.setTimeout(2500);

            const mocks = [
                jest.fn(() => appendOrder(0)),
                jest.fn(() => appendOrder(1)),
                jest.fn(() => appendOrder(2))
            ];

            const match0 = {match: '0'};
            const reduced = reduceActionSets([[
                [(m, h) => setTimeout(() => mocks[0](m, h), 300), match0],
                [(m, h) => setTimeout(() => mocks[1](m, h), 200), match0],
                [(m, h) => setTimeout(() => mocks[2](m, h), 100), match0]
            ]], actionParams);

            reduced.then(() => {
                setTimeout(() => {
                    expect(mocks[0].mock.calls).toHaveLength(1);
                    expect(mocks[0].mock.calls[0][0]).toEqual(match0);
                    expect(mocks[0].mock.calls[0][1]).toEqual(actionParams);

                    expect(mocks[1].mock.calls).toHaveLength(1);
                    expect(mocks[1].mock.calls[0][0]).toEqual(match0);
                    expect(mocks[1].mock.calls[0][1]).toEqual(actionParams);

                    expect(mocks[2].mock.calls).toHaveLength(1);
                    expect(mocks[2].mock.calls[0][0]).toEqual(match0);
                    expect(mocks[2].mock.calls[0][1]).toEqual(actionParams);

                    // verify order
                    expect(order).toEqual([2,1,0]);
                    done();
                }, 1000);
            });
        });

        test('reduceActionSets - serial', done => {

            jest.setTimeout(2500);

            const mocks = [
                jest.fn(() => appendOrder(0)),
                jest.fn(() => appendOrder(1)),
                jest.fn(() => appendOrder(2))
            ];

            const match0 = {match: '0'};
            const reduced = reduceActionSets([
                [[(m, h) => setTimeout(() => mocks[0](m, h), 300), match0]],
                [[(m, h) => setTimeout(() => mocks[1](m, h), 200), match0]],
                [[(m, h) => setTimeout(() => mocks[2](m, h), 100), match0]]
            ], actionParams);

            reduced.then(() => {
                setTimeout(() => {
                    expect(mocks[0].mock.calls).toHaveLength(1);
                    expect(mocks[0].mock.calls[0][0]).toEqual(match0);
                    expect(mocks[0].mock.calls[0][1]).toEqual(actionParams);

                    expect(mocks[1].mock.calls).toHaveLength(1);
                    expect(mocks[1].mock.calls[0][0]).toEqual(match0);
                    expect(mocks[1].mock.calls[0][1]).toEqual(actionParams);

                    expect(mocks[2].mock.calls).toHaveLength(1);
                    expect(mocks[2].mock.calls[0][0]).toEqual(match0);
                    expect(mocks[2].mock.calls[0][1]).toEqual(actionParams);

                    // verify order
                    expect(order).toEqual([2,1,0]);
                    done();
                }, 1000);
            });
        });

        test('returns promise when no routes matched', done => {
            const p = dispatchRouteActions(
                { pathname: '/helloworld' },
                { routes: [], dispatchActions, routeComponentPropNames, actionParams });

            p.then(() => {
                expect(mockHomeAction.mock.calls).toHaveLength(0);
                expect(mockRootAction.mock.calls).toHaveLength(0);
                done();
            });
        });

        test('returns promise when routes matched - dispatchAction function', done => {
            const p = dispatchRouteActions(
                { pathname: '/' },
                { routes, routeComponentPropNames, actionParams, dispatchActions: () => [['primary', 'secondary']]});

            p.then(() => {
                expect(mockHomeAction.mock.calls).toHaveLength(1);
                expect(mockRootAction.mock.calls).toHaveLength(1);
                expect(order).toEqual([0, 1]);

                // verify match params
                expect(actionParams[0][0].params).toBeDefined();
                expect(actionParams[0][0].isExact).toBeDefined();
                expect(actionParams[0][0].path).toBeDefined();
                expect(actionParams[0][0].url).toBeDefined();

                // verify action params
                expect(actionParams[0][1]).toEqual(actionParams);

                // verify route params
                expect(actionParams[0][2].route).toBeDefined();
                expect(actionParams[0][2].componentRouteKey).toBeDefined();
                done();
            });
        });

        test('returns promise when routes matched - flat', done => {
            const p = dispatchRouteActions(
                { pathname: '/' },
                { routes, dispatchActions, routeComponentPropNames, actionParams });

            p.then(() => {
                expect(mockHomeAction.mock.calls).toHaveLength(1);
                expect(mockRootAction.mock.calls).toHaveLength(1);
                expect(order).toEqual([0, 1]);
                done();
            });
        });

        test('returns promise when routes matched - serial', done => {
            const p = dispatchRouteActions(
                { pathname: '/' },
                { routes, dispatchActions: [['primary'], ['secondary']], routeComponentPropNames, actionParams });

            p.then(() => {
                expect(mockHomeAction.mock.calls).toHaveLength(1);
                expect(mockRootAction.mock.calls).toHaveLength(1);
                expect(order).toEqual([0, 1]);
                done();
            });
        });
    });
});
