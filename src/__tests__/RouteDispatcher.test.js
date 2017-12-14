import React from 'react';
import { shallow, mount } from './enzyme';
import { RouteDispatcher } from '../RouteDispatcher';
import { MemoryRouter } from 'react-router'

const LOAD_DATA = 'loadData';
const PARSE_DATA = 'parseData';
const DEFAULT_ACTION_NAMES = [[LOAD_DATA]];

describe('RouteDispatcher', () => {
    const location = { pathname: '/' };
    const defaultRoutes = [];
    let componentDispatch, clientDispatch, serverDispatch;

    beforeEach(() => {
        componentDispatch = RouteDispatcher.componentDispatch;
        clientDispatch = RouteDispatcher.dispatchClientActions;
        serverDispatch = RouteDispatcher.dispatchServerActions;
        RouteDispatcher.componentDispatch = jest.fn(() => Promise.resolve());
        RouteDispatcher.dispatchClientActions = jest.fn(() => Promise.resolve());
        RouteDispatcher.dispatchServerActions = jest.fn(() => Promise.resolve());
    });

    afterEach(() => {
        RouteDispatcher.componentDispatch = componentDispatch;
        RouteDispatcher.dispatchClientActions = clientDispatch;
        RouteDispatcher.dispatchServerActions = serverDispatch;
    });

    describe('constructor', () => {
        test('standardizes dispatchActions prop', () => {
            let dispatcher = new RouteDispatcher({ actionNames: LOAD_DATA });
            expect(dispatcher.state.dispatchActionNames).toEqual([[LOAD_DATA]]);

            dispatcher = new RouteDispatcher({ actionNames: [LOAD_DATA] });
            expect(dispatcher.state.dispatchActionNames).toEqual([[LOAD_DATA]]);

            dispatcher = new RouteDispatcher({ actionNames: [LOAD_DATA, PARSE_DATA] });
            expect(dispatcher.state.dispatchActionNames).toEqual([[LOAD_DATA, PARSE_DATA]]);

            dispatcher = new RouteDispatcher({ actionNames: [[LOAD_DATA]] });
            expect(dispatcher.state.dispatchActionNames).toEqual([[LOAD_DATA]]);

            dispatcher = new RouteDispatcher({ actionNames: [[LOAD_DATA], [PARSE_DATA]] });
            expect(dispatcher.state.dispatchActionNames).toEqual([[LOAD_DATA], [PARSE_DATA]]);

            dispatcher = new RouteDispatcher({ actionNames: () => [[LOAD_DATA]] });
            expect(typeof dispatcher.state.dispatchActionNames).toBe('function');
        });

        test('assigns state', () => {
            const dispatchActionsOnFirstRender = false;
            const dispatcher = new RouteDispatcher({ dispatchActionsOnFirstRender, actionNames: [[LOAD_DATA]] });

            expect(dispatcher.state.previousLocation).toBe(null);
            expect(dispatcher.state.hasDispatchedActions).toBe(!dispatchActionsOnFirstRender);
        });

        test('dispatches actions if not previously done', done => {
            const wrapper = shallow(<RouteDispatcher 
                location={location} 
                routes={defaultRoutes} 
                dispatchActionsOnFirstRender={true} 
                actionNames={() => [[LOAD_DATA]]} />);

            setImmediate(() => {
                expect(RouteDispatcher.componentDispatch.mock.calls).toHaveLength(1);
                expect(wrapper.state('hasDispatchedActions')).toBe(true);
                done();
            });
        });
    });

    describe('componentWillMount', () => {
        test('does not dispatch actions if previously dispatched', () => {
            shallow(<RouteDispatcher routes={defaultRoutes} dispatchActionsOnFirstRender={false} actionNames={DEFAULT_ACTION_NAMES} />);
            expect(RouteDispatcher.componentDispatch.mock.calls).toHaveLength(0);
        });

        test('dispatches actions if not previously done', done => {
            const wrapper = shallow(<RouteDispatcher location={location} routes={defaultRoutes} dispatchActionsOnFirstRender={true} actionNames={DEFAULT_ACTION_NAMES} />);

            setImmediate(() => {
                expect(RouteDispatcher.componentDispatch.mock.calls).toHaveLength(1);
                expect(wrapper.state('hasDispatchedActions')).toBe(true);
                done();
            });
        });
    });

    describe('componentWillReceiveProps', () => {
        test('does not dispatch actions when location has not changed', () => {
            const currentLocation = {};
            const wrapper = shallow(<RouteDispatcher routes={defaultRoutes} dispatchActionsOnFirstRender={false} location={currentLocation} actionNames={DEFAULT_ACTION_NAMES} />);
            wrapper.instance().componentWillReceiveProps({ location: currentLocation });

            expect(RouteDispatcher.componentDispatch.mock.calls).toHaveLength(0);
            expect(wrapper.state('previousLocation')).toBe(null);
        });

        test('does not dispatch actions when dispatchActions has not changed', () => {
            const wrapper = shallow(<RouteDispatcher routes={defaultRoutes} dispatchActionsOnFirstRender={false} actionNames={[[LOAD_DATA]]} />);
            wrapper.instance().componentWillReceiveProps({ actionNames: [[LOAD_DATA]] });

            expect(RouteDispatcher.componentDispatch.mock.calls).toHaveLength(0);
            expect(wrapper.state('previousLocation')).toBe(null);
        });

        test('does not dispatch actions when dispatchActions function has not changed', () => {
            const dispActionFunc = () => {};
            const wrapper = shallow(<RouteDispatcher routes={defaultRoutes} dispatchActionsOnFirstRender={false} actionNames={dispActionFunc} />);
            wrapper.instance().componentWillReceiveProps({ actionNames: dispActionFunc });

            expect(RouteDispatcher.componentDispatch.mock.calls).toHaveLength(0);
            expect(wrapper.state('previousLocation')).toBe(null);
        });

        test('dispatches actions when location has changed', done => {
            const newLocation = { pathname: '/root' };
            const wrapper = shallow(
                <RouteDispatcher
                    location={location}
                    routes={defaultRoutes}
                    dispatchActionsOnFirstRender={false}
                    actionNames={DEFAULT_ACTION_NAMES} />);

            wrapper.instance().componentWillReceiveProps({ location: newLocation });

            expect(wrapper.state('previousLocation')).toEqual(location);
            setImmediate(() => {
                expect(RouteDispatcher.componentDispatch.mock.calls).toHaveLength(1);
                expect(wrapper.state('previousLocation')).toEqual(null);
                done();
            });
        });

        test('dispatches actions when dispatchActions has changed', done => {
            const wrapper = shallow(
                <RouteDispatcher
                    location={location}
                    routes={defaultRoutes}
                    dispatchActionsOnFirstRender={false}
                    actionNames={[[LOAD_DATA]]} />);

            wrapper.instance().componentWillReceiveProps({ actionNames: [[LOAD_DATA, PARSE_DATA]] });

            expect(wrapper.state('previousLocation')).toEqual(location);
            setImmediate(() => {
                expect(RouteDispatcher.componentDispatch.mock.calls).toHaveLength(1);
                expect(wrapper.state('previousLocation')).toEqual(null);
                done();
            });
        });

        test('dispatches actions when dispatchActions function has changed', done => {
            const dispActionFunc1 = () => {};
            const dispActionFunc2 = () => {};

            const wrapper = shallow(
                <RouteDispatcher
                    location={location}
                    routes={defaultRoutes}
                    dispatchActionsOnFirstRender={false}
                    actionNames={dispActionFunc1} />);

            wrapper.instance().componentWillReceiveProps({ actionNames: dispActionFunc2 });

            expect(wrapper.state('previousLocation')).toEqual(location);
            setImmediate(() => {
                expect(RouteDispatcher.componentDispatch.mock.calls).toHaveLength(1);
                expect(wrapper.state('previousLocation')).toEqual(null);
                done();
            });
        });
    });

    describe('render', () => {
        test('displays default loading component before actions have been dispatched', () => {
            const wrapper = shallow(<RouteDispatcher location={location} routes={defaultRoutes} dispatchActionsOnFirstRender={true} actionNames={DEFAULT_ACTION_NAMES} />);
            expect(wrapper.html()).toBe('<div>Loading...</div>');
        });

        test('displays loading component before actions have been dispatched', () => {
            class Indicator extends React.Component {
                render() {
                    return <div>component</div>;
                }
            }

            const wrapper = shallow(<RouteDispatcher loadingIndicator={Indicator} location={location} routes={defaultRoutes} dispatchActionsOnFirstRender={true} actionNames={DEFAULT_ACTION_NAMES} />);
            expect(wrapper.html()).toBe('<div>component</div>');
        });

        test('displays loading stateless component before actions have been dispatched', () => {
            const wrapper = shallow(<RouteDispatcher loadingIndicator={() => <div>stateless</div>} location={location} routes={defaultRoutes} dispatchActionsOnFirstRender={true} actionNames={DEFAULT_ACTION_NAMES} />);
            expect(wrapper.html()).toBe('<div>stateless</div>');
        });

        test('displays loading markup before actions have been dispatched', () => {
            const wrapper = shallow(<RouteDispatcher loadingIndicator="markup" location={location} routes={defaultRoutes} dispatchActionsOnFirstRender={true} actionNames={DEFAULT_ACTION_NAMES} />);
            expect(wrapper.html()).toBe('<div>markup</div>');
        });

        test('renders routes', () => {
            const mockRender = jest.fn(() => null);
            const routes = [];
            mount(
                <MemoryRouter>
                    <RouteDispatcher dispatchActionsOnFirstRender={false} render={mockRender} routes={routes} renderProp={'1'} actionNames={DEFAULT_ACTION_NAMES} />
                </MemoryRouter>
            );

            expect(mockRender.mock.calls).toHaveLength(1);
            expect(mockRender.mock.calls[0][0]).toEqual(routes);
            expect(mockRender.mock.calls[0][1]).toEqual({ renderProp: '1' });
        });

        test('returns null if no routes exist', () => {
            const wrapper = mount(
                <MemoryRouter>
                    <RouteDispatcher routes={defaultRoutes} dispatchActionsOnFirstRender={false} actionNames={DEFAULT_ACTION_NAMES} />
                </MemoryRouter>
            );
            expect(wrapper.html()).toBe(null);
        });
    });
});
