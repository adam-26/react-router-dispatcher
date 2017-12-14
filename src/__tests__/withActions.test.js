import React from 'react';
import withActions from '../withActions';
import { mount } from './enzyme';

class TestComponent extends React.Component {

    static redundantMethod() {
        return '';
    }

    render() {
        return <div>test</div>;
    }
}

describe('withActions', () => {

    beforeEach(() => {
    });

    afterEach(() => {
    });

    test('validates action', () => {
        expect(() => withActions({})).toThrow(/name/);
        expect(() => withActions({ name: 1 })).toThrow(/name/);

        expect(() => withActions({ name: 'n' })).toThrow(/staticMethodName/);
        expect(() => withActions({ name: 'n', staticMethodName: 1 })).toThrow(/staticMethodName/);

        expect(() => withActions({ name: 'n', staticMethodName: 's' })).toThrow(/mapParamsToProps/);
        expect(() =>
            withActions({ name: 'n', staticMethodName: 's', mapParamsToProps: 1 })).toThrow(/mapParamsToProps/);

        expect(() => withActions({
            name: 'n',
            staticMethodName: 's',
            mapParamsToProps: () => {},
            initServerAction: 1
        })).toThrow(/initServerAction/);

        expect(() => withActions({
            name: 'n',
            staticMethodName: 's',
            mapParamsToProps: () => {},
            initClientAction: 1
        })).toThrow(/initClientAction/);

        expect(() => withActions({
            name: 'n',
            staticMethodName: 's',
            mapParamsToProps: () => {},
            hoc: 1
        })).toThrow(/hoc/);
    });

    test('throws when component has not defined the static method required by the action', () => {
        expect(() => withActions({
            name: 'n',
            staticMethodName: 's',
            mapParamsToProps: () => {},
        })(TestComponent)).toThrow(/missing the required static/);
    });

    test('does not throw when action defines static method', () => {
        expect(() => withActions({
            name: 'n',
            staticMethod: () => {},
            staticMethodName: 'redundantMethod',
            mapParamsToProps: () => {},
        })(TestComponent)).not.toThrow();
    });

    describe('getDispatcherActions', () => {
        let actionComponent;
        beforeAll(() => {
            actionComponent = withActions({
                name: 'action1',
                staticMethod: () => {},
                staticMethodName: 'method1',
                mapParamsToProps: () => {},
            }, {
                name: 'action2',
                staticMethod: () => {},
                initServerAction: p => p,
                staticMethodName: 'method1',
                mapParamsToProps: () => {},
            }, {
                name: 'action3',
                initClientAction: p => p,
                staticMethod: () => {},
                staticMethodName: 'method1',
                mapParamsToProps: () => {},
            })(TestComponent);
        });

        test('returns all assigned methods', () => {
            expect(
                actionComponent.getDispatcherActions().map(a => a.name))
                .toEqual(['action1', 'action2', 'action3']);
        });

        test('returns filtered action names', () => {
            expect(
                actionComponent.getDispatcherActions(['action1', 'action3']).map(a => a.name))
                .toEqual(['action1', 'action3']);
        });

        test('returns filtered actions', () => {
            expect(
                actionComponent
                    .getDispatcherActions(null, a => typeof a.initServerAction === 'function')
                    .map(a => a.name))
                .toEqual(['action2']);
        });
    });

    test('applies action HOC', () => {
        const HOC = (actionName) => (Component) => {
            const wrapped = (props) => (
                <div>
                    <span>{actionName}</span>
                    <Component {...props} />
                </div>
            );
            wrapped.displayName = 'wrapped';
            return wrapped;
        };

        const ActionComponent = withActions({
            name: 'action1',
            staticMethod: () => {},
            mapParamsToProps: () => {},
            hoc: HOC('action1')
        }, {
            name: 'action2',
            staticMethod: () => {},
            mapParamsToProps: () => {},
            hoc: HOC('action2')
        }, {
            name: 'action3',
            staticMethod: () => {},
            mapParamsToProps: () => {},
            hoc: HOC('action3')
        })(TestComponent);

        const wrapper = mount(<ActionComponent>Hello World</ActionComponent>);
        expect(
            wrapper.html())
            .toBe('<div><span>action1</span><div><span>action2</span><div><span>action3</span><div>test</div></div></div></div>');
    });
});
