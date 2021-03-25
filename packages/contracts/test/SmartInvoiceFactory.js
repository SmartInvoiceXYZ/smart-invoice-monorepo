const { expect, use } = require("chai");
const { waffle } = require("hardhat");
const { awaitInvoiceAddress } = require("./utils");
const { solidity } = waffle;
// const { Contract, BigNumber } = require("ethers");

use(solidity);

const EMPTY_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
const WETH_XDAI = "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d";
// const WETH_RINKEBY = "0xc778417E063141139Fce010982780140Aa0cD5Ab";

describe("SmartInvoiceFactory", async () => {
  let SmartInvoiceFactory;
  let invoiceFactory;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async () => {
    SmartInvoiceFactory = await ethers.getContractFactory(
      "SmartInvoiceFactory",
    );
    invoiceFactory = await SmartInvoiceFactory.deploy();

    await invoiceFactory.deployed();

    [owner, addr1, addr2] = await ethers.getSigners();
  });

  it("Should deploy with 0 invoiceCount", async () => {
    const invoiceCount = await invoiceFactory.invoiceCount();
    expect(invoiceCount).to.equal(0);
  });

  let invoiceAddress;
  let client;
  let provider;
  let resolverType = 0;
  let resolver;
  let token = WETH_XDAI;
  let amounts = [10, 10];
  let total = amounts.reduce((t, v) => t + v, 0);
  let terminationTime =
    parseInt(new Date().getTime() / 1000, 10) + 30 * 24 * 60 * 60;
  let details = EMPTY_BYTES32;

  it("Should deploy a SmartInvoice", async () => {
    client = owner.address;
    provider = addr1.address;
    resolver = addr2.address;
    const receipt = await invoiceFactory.create(
      client,
      provider,
      resolverType,
      resolver,
      token,
      amounts,
      terminationTime,
      details,
    );
    invoiceAddress = await awaitInvoiceAddress(await receipt.wait());
    expect(receipt)
      .to.emit(invoiceFactory, "LogNewInvoice")
      .withArgs(0, invoiceAddress, amounts);

    const SmartInvoice = await ethers.getContractFactory("SmartInvoice");
    const invoice = await SmartInvoice.attach(invoiceAddress);

    expect(await invoice.client()).to.equal(client);
    expect((await invoice.functions.provider())[0]).to.equal(provider);
    expect(await invoice.resolverType()).to.equal(resolverType);
    expect(await invoice.resolver()).to.equal(resolver);
    expect(await invoice.token()).to.equal(token);
    amounts.map(async (v, i) => {
      expect(await invoice.amounts(i)).to.equal(v);
    });
    expect(await invoice.terminationTime()).to.equal(terminationTime);
    expect(await invoice.details()).to.equal(details);
    expect(await invoice.resolutionRate()).to.equal(20);
    expect(await invoice.milestone()).to.equal(0);
    expect(await invoice.total()).to.equal(total);
    expect(await invoice.locked()).to.equal(false);
    expect(await invoice.disputeId()).to.equal(0);

    expect(await invoiceFactory.getInvoiceAddress(0)).to.equal(invoiceAddress);
  });

  it("Should update resolutionRate", async () => {
    let resolutionRate = await invoiceFactory.resolutionRates(addr2.address);
    expect(resolutionRate).to.equal(0);
    const receipt = await invoiceFactory
      .connect(addr2)
      .updateResolutionRate(10, details);
    expect(receipt)
      .to.emit(invoiceFactory, "UpdateResolutionRate")
      .withArgs(addr2.address, 10, details);

    resolutionRate = await invoiceFactory.resolutionRates(addr2.address);
    expect(resolutionRate).to.equal(10);
  });

  it("Should deploy with new resolutionRate", async () => {
    await invoiceFactory.connect(addr2).updateResolutionRate(10, details);
    client = owner.address;
    provider = addr1.address;
    resolver = addr2.address;
    const receipt = await invoiceFactory.create(
      client,
      provider,
      resolverType,
      resolver,
      token,
      amounts,
      terminationTime,
      details,
    );
    invoiceAddress = await awaitInvoiceAddress(await receipt.wait());
    expect(receipt)
      .to.emit(invoiceFactory, "LogNewInvoice")
      .withArgs(0, invoiceAddress, amounts);

    const SmartInvoice = await ethers.getContractFactory("SmartInvoice");
    const invoice = await SmartInvoice.attach(invoiceAddress);

    expect(await invoice.resolutionRate()).to.equal(10);

    expect(await invoiceFactory.getInvoiceAddress(0)).to.equal(invoiceAddress);
  });

  it("Should update invoiceCount", async () => {
    expect(await invoiceFactory.invoiceCount()).to.equal(0);
    let receipt = await invoiceFactory.create(
      client,
      provider,
      resolverType,
      resolver,
      token,
      amounts,
      terminationTime,
      details,
    );
    const invoice0 = await awaitInvoiceAddress(await receipt.wait());
    expect(await invoiceFactory.invoiceCount()).to.equal(1);
    receipt = await invoiceFactory.create(
      client,
      provider,
      resolverType,
      resolver,
      token,
      amounts,
      terminationTime,
      details,
    );
    const invoice1 = await awaitInvoiceAddress(await receipt.wait());
    expect(await invoiceFactory.invoiceCount()).to.equal(2);

    expect(await invoiceFactory.getInvoiceAddress(0)).to.equal(invoice0);
    expect(await invoiceFactory.getInvoiceAddress(1)).to.equal(invoice1);
  });
});