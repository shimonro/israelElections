import {Pie} from 'react-chartjs-2'
import React, {Component} from 'react'

export default class PieComponent extends Component
{
    constructor (props)
    {
        super (props)

        this.state ={
            datasets: [{
                data: [],
                backgroundColor: ['#52D726','#FFEC00', '#FF7300', '#FF0000', '#007ED6', '#7CDDDD']
            }]
        }
    }

    static getDerivedStateFromProps(nextProps, prevState)
	{
        const results = nextProps.data
        var blocks = new Array(6).fill(0)
        
        results.map((item)=>blocks[item.BlockID] += item.Mandates )

		return {datasets: [{
            data: blocks,
            backgroundColor: ['#52D726','#FFEC00', '#FF7300', '#FF0000', '#007ED6', '#7CDDDD']}]}
    }

    render()
    {
        return(
            <div>
                <Pie
                data = {{labels: (this.props.isEnglish)?
                                    ['Centre','Religious','Right','Sectorial','Arabs','Left']:
                                    ['מרכז','דתיים','ימין','סקטוריאלית','ערבית','שמאל'],
                        datasets: this.state.datasets,
                        }}
                height = '50%'
                />
            </div>
        )
    }
}