import { connect } from 'react-redux';
import RouteDispatcherComponent from '../components/RouteDispatcherComponent';
import { beginGlobalLoad, endGlobalLoad } from '../store';

export default connect(null, { beginGlobalLoad, endGlobalLoad })(RouteDispatcherComponent);
