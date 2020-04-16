import React, {Component} from 'react'
import './menuComponent.css'
export default class MenuComponent extends Component
{

    render()
    {
        return(
            <div>
                <button
                    className = "topButton"
                    onClick={() => this.props.onClickRunning()}
                >
                    {this.props.isRunning} 
                </button>
                <button
                    className = "topButton"
                    onClick={() => this.props.onClickLang()}
                >
                    {this.props.isEnglish} 
                </button>
            </div>
        )
    }
}