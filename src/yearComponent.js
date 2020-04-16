import React, {Component} from 'react'

export default class YearComponent extends Component
{
    constructor (props)
    {
        super (props)
        this.currentYear = 0
        this.currentParlament = 0
        this.currentGovernment = 0
        this.state ={year: 0,
                    Parlament: 0,
                    Government: 0
                    }
    }

    static getDerivedStateFromProps(nextProps, prevState)
	{
        return {year: nextProps.currentYear,
                Parlament: nextProps.currentParlament,
                Government: nextProps.currentGovernment}
	}
    
    render()
    {
        return(
            <div className="Year">
			    {this.state.year} <br/>
                {this.state.Parlament} <br/>
                {this.state.Government}
            </div>
        )
    }
}