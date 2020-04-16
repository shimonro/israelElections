import React, {Component} from 'react'
import Images from './data/PMImages'

export default class PhotoComponent extends Component
{
    constructor (props)
    {
        super (props)
        this.pmImages = Images
        this.currentPhotoID = 0
        this.state ={pmID: 0}
    }

    static getDerivedStateFromProps(nextProps, prevState)
	{
		return {pmID: nextProps.currentPhotoID}
	}
    
    render()
    {
        return(
            <table className="PhotoTable">
                <tr>
                    <img src={this.pmImages[this.state.pmID]} width="100" height="80" alt={this.props.namePM}></img>
                </tr>
                <tr>
                    {this.props.namePM}
                </tr>
            </table>
        )
    }
}