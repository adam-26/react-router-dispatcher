import { connect } from 'react-redux';
import { AsyncRouteLoader } from '../components/AsyncRouteLoader';
import { beginGlobalLoad, endGlobalLoad } from '../store';

export default connect(null, { beginGlobalLoad, endGlobalLoad })(AsyncRouteLoader);
