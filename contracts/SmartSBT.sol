// SPDX-License-Identifier: MIT

/*
 * Created by masataka.eth (@masataka_net)
 */

pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "erc721a/contracts/extensions/ERC721AQueryable.sol";
import { BitOpe } from 'bitope/contracts/libs/BitOpe.sol';
import "./interface/ITokenURI.sol";
import "./interface/IWalletFamily.sol";

contract SmartSBT is AccessControl,ERC721AQueryable  {
  using Strings for uint256;
  using BitOpe for uint256;
  using BitOpe for uint64;

  // Upgradable FullOnChain
  ITokenURI public tokenuri;
  IWalletFamily public walletfamily;

  string public baseURI;
  string public baseExtension = ".json";
  uint256 public maxSupply = 3000;
  bool public paused = true;
  bytes32 public merkleRoot;
  uint256 public limitGroup;  //0 start
  uint256 public alcount; // max:65535 Always raiseOrder

  // for payable
  uint256 public cost = 0.001 ether;
  address public  withdrawAddress;

  // constructor(
  // ) ERC721A("SmartSBT", "SSBT") {
  constructor(
  ) ERC721A("Aopanda Party SBT Memorial", "APSM") {
      _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
  }

  function supportsInterface(bytes4 interfaceId) public view virtual 
      override(AccessControl,IERC721A,ERC721A) returns (bool) {
      return
      interfaceId == type(IAccessControl).interfaceId ||
      super.supportsInterface(interfaceId);
  }

  // internal
  function _startTokenId() internal view virtual override returns (uint256) {
    return 1;
  } 

  function _baseURI() internal view virtual override returns (string memory) {
    return baseURI;
  }

  function _resetAlCount(address _owner) internal{
      uint64 _auxval = _getAux(_owner);
      if(_auxval.get16_forAux(0) < alcount){
          _setAux(_owner,_auxval.set16_forAux(0,uint64(alcount)).set16_forAux(1,0));  // CountUp + Clear
      }
  }

  function _getAuxforAlAmount(address _owner) internal returns (uint64){
      _resetAlCount(_owner);
      return _getAux(_owner).get16_forAux(1);
  }

  function _setAuxforAl(address _owner, uint64 _aux) internal {
      _resetAlCount(_owner);
      _setAux(_owner,_getAux(_owner).set16_forAux(1,_aux));
  }

  function _setmintedCount(address _owner,uint256 _mintAmount) internal{
      unchecked {
          _setAuxforAl(_owner,_getAuxforAlAmount(_owner) + uint64(_mintAmount));
      }
  }

  // external / public
  function getAlRemain(address _address,uint256 _amountMax,uint256 _group,bytes32[] calldata _merkleProof)
    public view returns (uint256) {
    uint256 _Amount = 0;
    if(paused == false){
        if(getAlExit(_address,_amountMax,_group,_merkleProof) == true){
            if(_getAux(_address).get16_forAux(0) < alcount){
                _Amount = _amountMax;
            }else{
                _Amount = _amountMax - _getAux(_address).get16_forAux(1);
            }
        } 
    }
    return _Amount;
  }

  function getAlExit(address _address,uint256 _amountMax,uint256 _group,bytes32[] calldata _merkleProof) 
    public view returns (bool) {
      bool _exit = false;
      bytes32 _leaf = keccak256(abi.encodePacked(_address,_amountMax,_group));   

      if(MerkleProof.verifyCalldata(_merkleProof, merkleRoot, _leaf) == true){
          _exit = true;
      }

      return _exit;
  }

  function alMint(uint256 _mintAmount,uint256 _amountMax,uint256 _group,bytes32[] calldata _merkleProof) external {
    uint256 supply = _totalMinted();
    require(!paused, "mint is paused");
    require(_group <= limitGroup,"not target group");
    require(tx.origin == msg.sender,"the caller is another controler");
    require(getAlExit(msg.sender,_amountMax,_group,_merkleProof) == true,"You don't have a whitelist");
    require(_mintAmount > 0,"mintAmount is zero");
    _resetAlCount(msg.sender);  // Always check reset before getAlRemain
    require(_mintAmount <= getAlRemain(msg.sender,_amountMax,_group,_merkleProof), "claim is over max amount");
    require(supply + _mintAmount <= maxSupply,"over max supply");

    _setmintedCount(msg.sender, _mintAmount);
    _safeMint(msg.sender, _mintAmount);
  }

  // sale option
  function alMintPayable(uint256 _mintAmount,uint256 _amountMax,uint256 _group,bytes32[] calldata _merkleProof) external payable{
    uint256 supply = _totalMinted();
    require(!paused, "mint is paused");
    require(_group <= limitGroup,"not target group");
    require(tx.origin == msg.sender,"the caller is another controler");
    require(getAlExit(msg.sender,_amountMax,_group,_merkleProof) == true,"You don't have a whitelist");
    require(_mintAmount > 0,"mintAmount is zero");
    _resetAlCount(msg.sender);  // Always check reset before getAlRemain
    require(_mintAmount <= getAlRemain(msg.sender,_amountMax,_group,_merkleProof), "claim is over max amount");
    require(supply + _mintAmount <= maxSupply,"over max supply");
    require(msg.value >= cost * _mintAmount, "not enough eth");

    _setmintedCount(msg.sender, _mintAmount);
    _safeMint(msg.sender, _mintAmount);
  }

  // sale option
  function mintPayable(uint256 _mintAmount) external payable{
    uint256 supply = _totalMinted();
    require(!paused, "mint is paused");
    require(tx.origin == msg.sender,"the caller is another controler");
    require(_mintAmount > 0,"mintAmount is zero");
    require(supply + _mintAmount <= maxSupply,"over max supply");
    require(msg.value >= cost * _mintAmount, "not enough eth");

    _safeMint(msg.sender, _mintAmount);
  }

  function burn(uint256 burnTokenId) external {
    require (msg.sender == ownerOf(burnTokenId),"Only the owner can burn");
    _burn(burnTokenId);
  }

  function tokenURI(uint256 tokenId) public view virtual override(IERC721A,ERC721A)  returns (string memory){
    require(_exists(tokenId),"ERC721AMetadata: URI query for nonexistent token");
    if(address(tokenuri) == address(0)){
      return string(abi.encodePacked(ERC721A.tokenURI(tokenId), baseExtension));
    }else{
      // Full-on chain support
      return tokenuri.tokenURI_future(tokenId);
    }
  }

  // onlyAdmin
  modifier onlyAdmin() {
      _checkRole(DEFAULT_ADMIN_ROLE);
      _;
  }

  // option
  function airdropMint_array(address[] calldata _airdropAddresses , uint256[] memory _UserMintAmount) external onlyAdmin{
      uint256 supply = _totalMinted();
      uint256 _mintAmount = 0;
      for (uint256 i = 0; i < _UserMintAmount.length; i++) {
          _mintAmount += _UserMintAmount[i];
      }
      require(_mintAmount > 0, "need to mint at least 1 NFT");
      require(supply + _mintAmount <= maxSupply, "max NFT limit exceeded");
      require(_airdropAddresses.length ==  _UserMintAmount.length, "array length unmuch");

      for (uint256 i = 0; i < _UserMintAmount.length; i++) {
          _safeMint(_airdropAddresses[i], _UserMintAmount[i] );
      }
  }

  function setMaxSupply(uint256 _maxSupply) external onlyAdmin {
    maxSupply = _maxSupply;
  }
  
  function setBaseURI(string memory _newBaseURI) external onlyAdmin {
    baseURI = _newBaseURI;
  }

  function setBaseExtension(string memory _newBaseExtension) external onlyAdmin {
    baseExtension = _newBaseExtension;
  }

  function pause(bool _state) external onlyAdmin {
    paused = _state;
  }

  function setLimitGroup(uint256 _value) external onlyAdmin{
        limitGroup = _value;
  }

  function setMerkleRoot(bytes32 _merkleRoot) external onlyAdmin {
        merkleRoot = _merkleRoot;
    }

  function incAlcount() external onlyAdmin {
      require( paused == true,"no paused");
      require( alcount < 65535,"no Valid");
      unchecked {
          alcount += 1;
      }
  }

  function setTokenURI(ITokenURI _tokenuri) external onlyAdmin{
      tokenuri = _tokenuri;
  }

  function setWalletFamily(IWalletFamily _walletfamily) external onlyAdmin{
      walletfamily = _walletfamily;
  }

  // for payable
  function setCost(uint256 _value) external onlyAdmin {
      cost = _value;
  }

  function setWithdrawAddress(address _address) external onlyAdmin {
        withdrawAddress = _address;
  }

  function withdraw() external onlyAdmin {
      require(withdrawAddress != address(0),"address is invalid");
      (bool os, ) = payable(withdrawAddress).call{value: address(this).balance}("");
      require(os);
  }

  //SBT
  function approve(address , uint256 ) public payable override(IERC721A,ERC721A) {
    require(false, "This token is SBT, so this can not approval.");
  }

  function setApprovalForAll(address , bool ) public pure override(IERC721A,ERC721A) {
    require(false, "This token is SBT, so this can not approval.");
  }

  function transferFrom(address from, address to, uint256 tokenId) public payable override(IERC721A,ERC721A) {
    if(address(walletfamily) != address(0)){
      // migration SBT
      if(walletfamily.isChild(to) == true){
        super.transferFrom(from, to, tokenId);
        return;
      }     
    }
    require(false, "This token is SBT, so this can not transfer.");
  }
}