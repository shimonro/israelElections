import React, { Component } from 'react'
import './barComponent.css'
import Colors from './data/colorPallete'

export default class BarComponent extends Component
{
	constructor(props)
	{
		super(props)
		
		//default props
		this.backgroundColor= ((this.props.backgroundColor) ? this.props.backgroundColor : 'transparent')
		this.width= ((this.props.width) ? this.props.width : 760)
		this.itemHeight= ((this.props.itemHeight) ? this.props.itemHeight : 17)
		this.padding= ((this.props.padding) ? this.props.padding : 12)
		this.gap= ((this.props.gap) ? this.props.gap : 12)
		this.titleStyle= ((this.props.titleStyle) ? this.props.titleStyle : { font: 'normal 400 13px Arial', color: '#000' })
		this.valueStyle= ((this.props.valueStyle) ? this.props.valueStyle : { font: 'normal 400 11px Arial', color: 'rgba(255,255,255, 0.42)' })

		this.colors = Colors
		this.results = this.props.data
		
		this.state = {
			results: this.results.sort((a,b) => b.Mandates - a.Mandates),
			temp: this.results,
			maxValue: Math.max.apply(Math, this.results.map(item => item.Mandates)),
			isEnglish: true
		}
	}

	static getDerivedStateFromProps(nextProps, prevState)
	{
		let newProps = [...nextProps.data];
		return {
			results: nextProps.data,
			temp: newProps.sort((a,b) => b.Mandates - a.Mandates),
			maxValue: Math.max.apply(Math, nextProps.data.map(item => item.Mandates)),
			isEnglish: nextProps.isEnglish
		}
	}

	drawResults(item, index, isEnglish)
	{
		const itemIndex = this.state.temp.findIndex(temp => temp.PartyID === item.PartyID )
		const translateY = itemIndex === 0 ? this.padding : ( this.padding + ( itemIndex * this.itemHeight ) + ( itemIndex * this.gap ) )
		const itemTransform = 'translateY('+ translateY +'px) translateX('+ this.padding +'px)'
		const itemWidth = item.Mandates / this.state.maxValue * ( this.width - 120 - ( 2 * this.padding ) )
		return(
			<div key={index} className="raceItem" style={{ height: this.itemHeight, transform: itemTransform}}>
	<b style={{ backgroundColor: this.colors[item.PartyID], width: itemWidth}}>{item.Mandates}</b>

					<i style={this.titleStyle}>{ isEnglish? item.PartyEng: item.PartyHeb }</i>

			</div>
		)
	}

	render()
	{
		return(
			<div className="raceArea" style={{ 
				backgroundColor: this.backgroundColor, 
				paddingTop: this.padding, 
				paddingBottom: this.padding, 
				width: this.width, 
				height: (2*this.padding)+
						(this.state.temp.length * this.itemHeight)+
						((this.state.temp.length-1) * this.gap)}}>
				{this.state.results.map((item, index) => this.drawResults(item, index, this.state.isEnglish))}
			</div>
		)
	}
}