import React, { Component } from 'react'
import './container.css'
import PhotoComponent from './photoComponent'
import PieComponent from './pieComponent'
import MenuComponent from './menuComponent'
import YearComponent from './yearComponent'
import BarComponent from './barComponent'
import jsonData from './data/israelElections2020.json';

export default class Container extends Component{

	constructor(props)
	{
		super(props)

		//defaults
		this.tickDelay = ((this.props.tickDelay) ? this.props.tickDelay : 1200)
		
		// load all the data
		this.myData = JSON.parse(JSON.stringify(jsonData));
		
		//utility props
		this.len = this.myData.length
		this.counter = 0
	
		this.state = {	currentFrame: [],
						isRunning: true,
						isEnglish: true
					}

		setInterval(() => {this.tick()}, this.tickDelay)
	}

	tick()
	{
	  if (this.state.isRunning)
	  {
		//see if we need to start the cycle again
		if (this.counter === this.len) 
		{
			this.counter= 0
		}

		//load next frame
		this.setState({currentFrame: this.myData[this.counter++]})
	  }
	}
  
	toggleRunning()
	{
		this.setState({isRunning: !this.state.isRunning})
	}

	toggleLang()
	{
		this.setState({isEnglish: !this.state.isEnglish})
	}

	render()
	{
		if (this.state.currentFrame.length === 0)
		{
			//this is for the initial setup
			return null
		}
		return(
			<table class="mainElement">
				<tr>
					<td colSpan = "2">
						<MenuComponent
							isRunning={this.state.isRunning? 'Pause': 'Run'}
							isEnglish={this.state.isEnglish? 'עברית': 'English'}
							onClickRunning={() => this.toggleRunning()}
							onClickLang={() => this.toggleLang()}>	
						</MenuComponent>
					</td>
				</tr>
				<tr>
					<td rowSpan = "2">
						<div className="Blocks">
							<PieComponent
								data = {this.state.currentFrame.Results}
								isEnglish = {this.state.isEnglish}>
							</PieComponent>
						</div>
					</td>
					<td>
						<YearComponent
							currentYear = {(this.state.isEnglish)? 
								"year : " + this.state.currentFrame.Year:
								this.state.currentFrame.Year + " : שנה" }
							currentParlament = {(this.state.isEnglish)? 
								"Parlament : " + this.state.currentFrame.Parlament:
								this.state.currentFrame.Parlament + " : כנסת" }
							currentGovernment = {(this.state.isEnglish)? 
									"Government : " + this.state.currentFrame.Government:
									this.state.currentFrame.Government + " : ממשלה" }>
						</YearComponent>
					</td>
				</tr>
				<tr>

					<td>
						<div className="PM">
							<PhotoComponent
								currentPhotoID = {this.state.currentFrame.PM.PMID}
								namePM  = {(this.state.isEnglish)?this.state.currentFrame.PM.PMEng: this.state.currentFrame.PM.PMHeb }>
							</PhotoComponent>
						</div>
					</td>
				</tr>
				<tr>
					<td colSpan = "2">
						<div className="raceArea">
							<BarComponent
								data = {this.state.currentFrame.Results}
								isEnglish = {this.state.isEnglish}>
							</BarComponent>
						</div>
					</td>
				</tr>
			</table>
		)
	}
}