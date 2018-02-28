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
        expect(() => withActions({})).toThrow(/mapParamsToProps/);
        expect(() => withActions(false)).toThrow(/mapParamsToProps/);

        expect(() => withActions(null, {})).toThrow(/name/);
        expect(() => withActions(null, { name: 1 })).toThrow(/name/);

        expect(() => withActions(null, { name: 'n' })).toThrow(/staticMethodName/);
        expect(() => withActions(null, { name: 'n', staticMethodName: 1 })).toThrow(/staticMethodName/);

        expect(() => withActions(null, {
            name: 'n',
            staticMethodName: 's',
            filterParamsToProps: false
        })).toThrow(/filterParamsToProps/);

        expect(() => withActions(null, {
            name: 'n',
            staticMethodName: 's',
        })).toThrow(/filterParamsToProps/);

        expect(() => withActions(null, {
            name: 'n',
            staticMethodName: 's',
            filterParamsToProps: () => {},
            initServerAction: 1
        })).toThrow(/initServerAction/);

        expect(() => withActions(null, {
            name: 'n',
            staticMethodName: 's',
            filterParamsToProps: () => {},
            initClientAction: 1
        })).toThrow(/initClientAction/);

        expect(() => withActions(null, {
            name: 'n',
            staticMethodName: 's',
            filterParamsToProps: () => {},
            hoc: 1
        })).toThrow(/hoc/);
    });

    test('throws when component has not defined the static method required by the action', () => {
        expect(() => withActions(null, {
            name: 'n',
            staticMethodName: 's',
            filterParamsToProps: () => {},
        })(TestComponent)).toThrow(/missing the required static/);
    });

    test('does not throw when action defines static method', () => {
        expect(() => withActions(null, {
            name: 'n',
            staticMethod: () => {},
            staticMethodName: 'redundantMethod',
            filterParamsToProps: () => {},
        })(TestComponent)).not.toThrow();
    });

    describe('getDispatcherActions', () => {
        let actionComponent;
        beforeAll(() => {
            actionComponent = withActions(null, {
                name: 'action1',
                staticMethod: () => {},
                staticMethodName: 'method1',
                filterParamsToProps: () => {},
            }, {
                name: 'action2',
                staticMethod: () => {},
                initServerAction: p => p,
                staticMethodName: 'method1',
                filterParamsToProps: () => {},
            }, {
                name: 'action3',
                initClientAction: p => p,
                staticMethod: () => {},
                staticMethodName: 'method1',
                filterParamsToProps: () => {},
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

        test('applies multiple withActions() actions to component', () => {
            actionComponent = withActions(null, {
                name: 'action1',
                staticMethod: () => {},
                staticMethodName: 'method1',
                filterParamsToProps: () => {},
            })(TestComponent);
            actionComponent = withActions(null, {
                name: 'action2',
                staticMethod: () => {},
                initServerAction: p => p,
                staticMethodName: 'method2',
                filterParamsToProps: () => {},
            })(actionComponent);
            actionComponent = withActions(null, {
                name: 'action3',
                initClientAction: p => p,
                staticMethod: () => {},
                staticMethodName: 'method3',
                filterParamsToProps: () => {},
            })(actionComponent);

            expect(
                actionComponent.getDispatcherActions().map(a => a.name))
                .toEqual(['action1', 'action2', 'action3']);
        });

        test('applies withActions() to a null component', () => {
            actionComponent = withActions(null, {
                name: 'action1',
                staticMethod: () => {},
                filterParamsToProps: () => {},
            })(null);

            expect(
                actionComponent.getDispatcherActions().map(a => a.name))
                .toEqual(['action1']);
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

        const ActionComponent = withActions(null, {
            name: 'action1',
            staticMethod: () => {},
            filterParamsToProps: () => {},
            hoc: HOC('action1')
        }, {
            name: 'action2',
            staticMethod: () => {},
            filterParamsToProps: () => {},
            hoc: HOC('action2')
        }, {
            name: 'action3',
            staticMethod: () => {},
            filterParamsToProps: () => {},
            hoc: HOC('action3')
        })(TestComponent);

        const wrapper = mount(<ActionComponent>Hello World</ActionComponent>);
        expect(
            wrapper.html())
            .toBe('<div><span>action1</span><div><span>action2</span><div><span>action3</span><div>test</div></div></div></div>');
    });
});
