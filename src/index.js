import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import detectEthereumProvider from '@metamask/detect-provider'
import Web3 from 'web3';

class ContractMethodSend extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      web3: props.web3,
      accounts: props.accounts,
      contract: props.contract,
      method: props.method,
      args: props.args,
      desc: props.desc,
      status: 'None',
      text: 0,
    };
    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  renderInputs() {
    const inputs = [];
    for (let i = 0; i < this.state.args.length; i++) {
      inputs.push(
        <div key={i}>
          <label>
            {this.state.args[i].title}
            <br />
            <input
              name={i}
              type={this.state.args[i].type}
              value={this.state.args[i].value}
              onChange={this.handleChange} />
          </label>
        </div>
      );
    }
    return inputs;
  }

  handleChange(event) {
    // console.log(event);
    let args = Object.assign([], this.state.args);
    args[event.target.name].value = event.target.value;
    this.setState({ args: args });
  }

  async handleSubmit(event) {
    event.preventDefault();
    const contract = this.state.contract;
    const method = this.state.method;
    const account = this.state.accounts[0];
    let args = [...event.target]
      .slice(0, event.target.length - 1)
      .map((e) => (e.value));
    let eGas = await contract.methods[method](...args).estimateGas({ from: account });

    this.setState({ status: 'Executing...' });
    contract.methods[method](...args)
      .send({ from: account, gas: Math.floor(eGas * 1.5) })
      .on('transactionHash', (hash) => {
        this.setState({
          status: [
            'Executing...',
            <br key='br' />,
            'Tx: ' + hash,
          ]
        });
      })
      .on('receipt', (receipt) => {
        this.setState({
          status: [
            'Completed.',
            <br key='br' />,
            'Tx: ' + receipt.transactionHash,
          ]
        });
      })
      .on('error', (error) => {
        if (typeof (this.state.status) === 'string') {
          this.setState({
            status: [
              'Error.',
              <br key='br' />,
              error.message,
            ]
          });
        } else {
          let status = this.state.status.slice();
          status[0] = 'Error.';
          this.setState({
            status: [
              ...status,
              <br key='br' />,
              error.message,
            ]
          });
        }
      })
  }

  render() {
    if (this.state.web3 === null) {
      return (
        <div>
          <h3>Loading Web3, accounts, and contract...</h3>
        </div>
      );
    }
    return (
      <div>
        <h3>{this.state.desc}</h3>
        <p>Status: {this.state.status}</p>
        <form onSubmit={this.handleSubmit}>
          {this.renderInputs()}
          <br />
          <input type="submit" value="submit" />
        </form>
      </div>
    );
  }
}

class Base extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      provider: null,
      chainId: null,
      accounts: [],
      web3: null,
      contracts: {
        gatewayManager: null,
      },
      gatewayManagerData: {
        threshold: null,
      },
    };

    // binding actions
    this.handleChainChanged = this.handleChainChanged.bind(this);
    this.handleAccountsChanged = this.handleAccountsChanged.bind(this)
  }

  async componentDidMount() {
    // this returns the provider, or null if it wasn't detected
    const provider = await detectEthereumProvider();

    await this.detectMetamaskEthereumProvider(provider);
    provider.on('chainChanged', this.handleChainChanged);

    // Note that this event is emitted on page load.
    // If the array of accounts is non-empty, you're already
    // connected.
    provider.on('accountsChanged', this.handleAccountsChanged);

    await this.loadContracts();
    await this.loadContractData();
  }

  async detectMetamaskEthereumProvider(provider) {
    if (provider) {
      // If the provider returned by detectEthereumProvider is not the same as
      // window.ethereum, something is overwriting it, perhaps another wallet.
      if (provider !== window.ethereum) {
        console.error('Do you have multiple wallets installed?');
      } else {
        this.state.provider = provider;
        this.state.web3 = new Web3(provider);
        const chainId = await provider.request({ method: 'eth_chainId' })
        this.state.chainId = this.state.web3.utils.hexToNumber(chainId);
      }
    } else {
      console.log('Please install MetaMask!');
    }
  }

  handleChainChanged(_chainId) {
    // We recommend reloading the page, unless you must do otherwise
    window.location.reload();

    console.log('handleChainChanged: ' + _chainId);
    console.log(this.state.web3.utils.hexToNumber(_chainId));
  }

  // For now, 'eth_accounts' will continue to always return an array
  handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
      // MetaMask is locked or the user has not connected any accounts
      console.log('Please connect to MetaMask.');

      this.setState({ accounts: [] });
    } else if (accounts !== this.state.accounts) {
      this.setState({ accounts: accounts });
      // Do any other work!
    }
  }

  connect() {
    this.state.provider
      .request({ method: 'eth_requestAccounts' })
      .then(this.handleAccountsChanged)
      .catch((err) => {
        if (err.code === 4001) {
          // EIP-1193 userRejectedRequest error
          // If this happens, the user rejected the connection request.
          console.log('Please connect to MetaMask.');
        } else {
          console.error(err);
        }
      });
  }

  async loadContracts() {
    // load artifacts.
    let res;
    switch (this.state.chainId) {
      case 80001:
        res = await fetch('./polygonMumbai.network.json');
        break;
      case 4:
        res = await fetch('./rinkeby.network.json');
        break;
      default:
        break
    }
    const artifacts = await res.json();

    // load contract.
    const web3 = this.state.web3;
    const { abi, address } = artifacts.contracts.GatewayManager;
    this.state.contracts.gatewayManager = new web3.eth.Contract(abi, address);
  }

  async loadContractData() {
    const gatewayManager = this.state.contracts.gatewayManager;
    const threshold = await gatewayManager.methods.threshold().call();

    let gatewayManagerData = Object.assign({}, this.state.gatewayManagerData);
    gatewayManagerData.threshold = threshold;
    this.setState({
      gatewayManagerData: gatewayManagerData,
    });
  }

  renderGMThresholdSettingView() {
    let props = {
      web3: this.state.web3,
      accounts: this.state.accounts,
      contract: this.state.contracts.gatewayManager,
      desc: 'set threshold',
      method: 'setThreshold',
      args: [
        {
          type: 'number',
          title: 'threshold',
          value: 0,
        },
      ],
    };
    return <ContractMethodSend {...props} />
  }

  render() {
    if (!this.state.provider || this.state.accounts.length === 0) {
      return (
        <div>
          v1.0.1
          <br />
          <button onClick={async () => { this.connect() }} >Connect</button>
        </div>
      );
    }

    return (
      <div>
        <div>Connected. {this.state.accounts[0]}</div>
        <br />
        <div>{`threshold: ${this.state.gatewayManagerData.threshold}`}</div>
        <div><button onClick={async () => { await this.loadContractData() }}>refresh</button></div>
        {this.renderGMThresholdSettingView()}
      </div>
    );
  }
}

// ========================================

ReactDOM.render(<Base />, document.getElementById("root"));
