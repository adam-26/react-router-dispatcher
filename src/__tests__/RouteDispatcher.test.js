import React from 'react';
import { shallow } from './enzyme';
import { RouteDispatcher } from '../RouteDispatcher';

describe('RouteDispatcher', () => {
    let dispatchActions;

    beforeEach(() => {
       dispatchActions = RouteDispatcher.dispatchActions;
       RouteDispatcher.dispatchActions = jest.fn(() => Promise.resolve());
    });

    afterEach(() => {
        RouteDispatcher.dispatchActions = dispatchActions;
    });

    describe('constructor', () => {
        test('standardizes dispatchActions prop', () => {
            let dispatcher = new RouteDispatcher({ dispatchActions: 'loadData' });
            expect(dispatcher.props.dispatchActions).toEqual([['loadData']]);

            dispatcher = new RouteDispatcher({ dispatchActions: ['loadData'] });
            expect(dispatcher.props.dispatchActions).toEqual([['loadData']]);

            dispatcher = new RouteDispatcher({ dispatchActions: ['loadData', 'parseData'] });
            expect(dispatcher.props.dispatchActions).toEqual([['loadData', 'parseData']]);

            dispatcher = new RouteDispatcher({ dispatchActions: [['loadData']] });
            expect(dispatcher.props.dispatchActions).toEqual([['loadData']]);

            dispatcher = new RouteDispatcher({ dispatchActions: [['loadData'], ['parseData']] });
            expect(dispatcher.props.dispatchActions).toEqual([['loadData'], ['parseData']]);
        });

        test('assigns state', () => {
            const hasDispatchedActions = true;
            const dispatcher = new RouteDispatcher({ hasDispatchedActions, dispatchActions: [['loadData']] });

            expect(dispatcher.state.previousLocation).toBe(null);
            expect(dispatcher.state.hasDispatchedActions).toBe(hasDispatchedActions);
        });

        test('dispatches actions if not previously done', done => {
            const wrapper = shallow(<RouteDispatcher hasDispatchedActions={false} />);

            setImmediate(() => {
                expect(RouteDispatcher.dispatchActions.mock.calls).toHaveLength(1);
                expect(wrapper.state('hasDispatchedActions')).toBe(true);
                done();
            });
        });
    });

    describe('componentWillMount', () => {
        test('does not dispatch actions if previously dispatched', () => {
            shallow(<RouteDispatcher hasDispatchedActions={true} />);
            expect(RouteDispatcher.dispatchActions.mock.calls).toHaveLength(0);
        });

        test('dispatches actions if not previously done', done => {
            const wrapper = shallow(<RouteDispatcher hasDispatchedActions={false} />);

            setImmediate(() => {
                expect(RouteDispatcher.dispatchActions.mock.calls).toHaveLength(1);
                expect(wrapper.state('hasDispatchedActions')).toBe(true);
                done();
            });
        });
    });

    describe('componentWillReceiveProps', () => {
        test('does not dispatch actions location has not changed', () => {
            const currentLocation = {};
            const wrapper = shallow(<RouteDispatcher hasDispatchedActions={true} location={currentLocation} />);
            wrapper.instance().componentWillReceiveProps({ location: currentLocation });

            expect(RouteDispatcher.dispatchActions.mock.calls).toHaveLength(0);
            expect(wrapper.state('previousLocation')).toBe(null);
        });

        test('dispatches actions when location has changed', done => {
            const currentLocation = { pathname: '/home' };
            const newLocation = { pathname: '/root' };
            const wrapper = shallow(<RouteDispatcher hasDispatchedActions={true} location={currentLocation} />);
            wrapper.instance().componentWillReceiveProps({ location: newLocation });

            expect(wrapper.state('previousLocation')).toEqual(currentLocation);
            setImmediate(() => {
                expect(RouteDispatcher.dispatchActions.mock.calls).toHaveLength(1);
                expect(wrapper.state('previousLocation')).toEqual(null);
                done();
            });
        });
    });

    describe('render', () => {
        test('displays loading component before actions have been dispatched', () => {
            const wrapper = shallow(<RouteDispatcher hasDispatchedActions={false} />);
            expect(wrapper.html()).toBe('<div>Loading...</div>');
        });

        test('renders routes', () => {
            const mockRender = jest.fn();
            const routes = [];
            shallow(<RouteDispatcher hasDispatchedActions={true} render={mockRender} routes={routes} />);

            expect(mockRender.mock.calls).toHaveLength(1);
            expect(mockRender.mock.calls[0][0]).toEqual(routes);
        });

        test('returns null if no routes exist', () => {
            const wrapper = shallow(<RouteDispatcher hasDispatchedActions={true} />);
            expect(wrapper.html()).toBe(null);
        });
    });
});
